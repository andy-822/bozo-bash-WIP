import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId } from '@/lib/validation';
import {
  ScoringCalculator,
  getLeagueScoringRules,
  recalculateUserSeasonStats,
  type Pick
} from '@/lib/scoring';

export async function POST(request: NextRequest) {
    try {
        const { action, season_id, game_id } = await request.json();

        const supabase = await createServerSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (action === 'calculate_game_results') {
            // Validate game_id
            const gameValidation = validateId(game_id?.toString(), 'Game ID');
            if (!gameValidation.isValid) {
                return NextResponse.json({ error: gameValidation.errorMessage }, { status: 400 });
            }

            // Calculate and award points for a completed game
            const result = await calculateGameResults(game_id);
            return NextResponse.json(result);
        }

        if (action === 'recalculate_season') {
            // Validate season_id
            const seasonValidation = validateId(season_id?.toString(), 'Season ID');
            if (!seasonValidation.isValid) {
                return NextResponse.json({ error: seasonValidation.errorMessage }, { status: 400 });
            }

            // Verify user has access to this season
            const { data: season } = await supabaseAdmin
                .from('seasons')
                .select(`
                    id,
                    leagues!inner(
                        id,
                        admin_id,
                        league_memberships!inner(user_id)
                    )
                `)
                .eq('id', season_id)
                .eq('leagues.league_memberships.user_id', user.id)
                .single();

            if (!season) {
                return NextResponse.json({ error: 'Season not found or access denied' }, { status: 404 });
            }

            // Recalculate all user stats for the season
            const result = await recalculateSeasonStats(season_id);
            return NextResponse.json(result);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (err) {
        console.error('API: Scoring error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function calculateGameResults(gameId: number) {
    try {
        // Get the completed game
        const { data: game, error: gameError } = await supabaseAdmin
            .from('games')
            .select('*')
            .eq('id', gameId)
            .eq('status', 'completed')
            .single();

        if (gameError || !game) {
            return { error: 'Game not found or not completed' };
        }

        // Get all picks for this game
        const { data: picks, error: picksError } = await supabaseAdmin
            .from('picks')
            .select('*')
            .eq('game_id', gameId);

        if (picksError) {
            return { error: 'Failed to fetch picks' };
        }

        if (!picks || picks.length === 0) {
            return { success: true, message: 'No picks to process' };
        }

        // Get season and league info for scoring rules
        const { data: season } = await supabaseAdmin
            .from('seasons')
            .select('id, league_id')
            .eq('id', game.season_id)
            .single();

        if (!season) {
            return { error: 'Season not found' };
        }

        const scoringRules = await getLeagueScoringRules(season.league_id);
        const calculator = new ScoringCalculator(scoringRules);

        let updatedPicks = 0;
        const affectedUsers = new Set<string>();

        // Process each pick using enhanced calculation
        for (const pick of picks) {
            const gameResult = {
                home_score: game.home_score,
                away_score: game.away_score,
                status: game.status
            };

            const pickResult = calculator.calculatePick(pick as Pick, gameResult);

            // Update the pick with result and points
            const { error: updateError } = await supabaseAdmin
                .from('picks')
                .update({
                    result: pickResult.result,
                    points_awarded: pickResult.points
                })
                .eq('id', pick.id);

            if (!updateError) {
                updatedPicks++;
                affectedUsers.add(pick.user_id);
                console.log(`Manual scoring - Pick ${pick.id}: ${pick.bet_type} ${pick.selection} -> ${pickResult.result} (${pickResult.points} pts) - ${pickResult.explanation}`);
            }
        }

        // Recalculate stats for affected users using enhanced function
        for (const userId of affectedUsers) {
            try {
                await recalculateUserSeasonStats(userId, game.season_id);
            } catch (error) {
                console.error(`Failed to recalculate stats for user ${userId}:`, error);
            }
        }

        return {
            success: true,
            updated_picks: updatedPicks,
            affected_users: affectedUsers.size
        };

    } catch (error) {
        console.error('Calculate game results error:', error);
        return { error: 'Failed to calculate results' };
    }
}


async function recalculateSeasonStats(seasonId: number) {
    try {
        // Get all users with picks in this season
        const { data: users, error: usersError } = await supabaseAdmin
            .from('picks')
            .select(`
                user_id,
                games!inner(season_id)
            `)
            .eq('games.season_id', seasonId);

        if (usersError) {
            return { error: 'Failed to fetch users' };
        }

        // Get unique user IDs
        const uniqueUserIds = [...new Set(users?.map(u => u.user_id) || [])];
        let recalculatedUsers = 0;

        for (const userId of uniqueUserIds) {
            try {
                await recalculateUserSeasonStats(userId, seasonId);
                recalculatedUsers++;
            } catch (error) {
                console.error(`Failed to recalculate stats for user ${userId}:`, error);
            }
        }

        return {
            success: true,
            recalculated_users: recalculatedUsers
        };

    } catch (error) {
        console.error('Recalculate season stats error:', error);
        return { error: 'Failed to recalculate stats' };
    }
}
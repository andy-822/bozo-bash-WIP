import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId } from '@/lib/validation';

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
            .select(`
                id,
                league_id,
                league_scoring_rules(*)
            `)
            .eq('id', game.season_id)
            .single();

        const scoringRules = season?.league_scoring_rules?.[0] || {
            points_per_win: 1,
            points_per_loss: 0,
            points_per_push: 0
        };

        let updatedPicks = 0;
        const affectedUsers = new Set<string>();

        // Process each pick
        for (const pick of picks) {
            const result = calculatePickResult(pick, game);
            const points = result === 'win' ? scoringRules.points_per_win :
                          result === 'loss' ? scoringRules.points_per_loss :
                          scoringRules.points_per_push;

            // Update the pick with result and points
            const { error: updateError } = await supabaseAdmin
                .from('picks')
                .update({
                    result: result,
                    points_awarded: points
                })
                .eq('id', pick.id);

            if (!updateError) {
                updatedPicks++;
                affectedUsers.add(pick.user_id);
            }
        }

        // Recalculate stats for affected users
        for (const userId of affectedUsers) {
            await supabaseAdmin.rpc('recalculate_user_season_stats', {
                p_user_id: userId,
                p_season_id: game.season_id
            });
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

function calculatePickResult(pick: { bet_type: string; selection: string }, game: { home_score: number | null; away_score: number | null }): string {
    const homeScore = game.home_score;
    const awayScore = game.away_score;

    if (homeScore === null || awayScore === null) {
        return 'pending';
    }

    if (homeScore === awayScore) {
        return 'push';
    }

    switch (pick.bet_type) {
        case 'moneyline':
            const winningTeam = homeScore > awayScore ? 'home' : 'away';
            return pick.selection.toLowerCase().includes(winningTeam) ? 'win' : 'loss';

        case 'spread':
            // For spreads, selection format should be like "TeamName +3.5" or "TeamName -7"
            // This is simplified - would need more sophisticated parsing in production
            const isHomeTeam = pick.selection.toLowerCase().includes('home');
            const actualSpread = homeScore - awayScore;

            // This is a simplified calculation - you'd want more robust spread parsing
            if (isHomeTeam) {
                return actualSpread > 0 ? 'win' : 'loss';
            } else {
                return actualSpread < 0 ? 'win' : 'loss';
            }

        case 'total':
            const totalPoints = homeScore + awayScore;
            const isOver = pick.selection.toLowerCase().includes('over');

            // Would need to parse the actual total from the pick selection
            // This is simplified
            const threshold = 45; // Would parse from pick.selection

            if (isOver) {
                return totalPoints > threshold ? 'win' : 'loss';
            } else {
                return totalPoints < threshold ? 'win' : 'loss';
            }

        default:
            return 'pending';
    }
}

async function recalculateSeasonStats(seasonId: number) {
    try {
        // Get all users with picks in this season
        const { data: users, error: usersError } = await supabaseAdmin
            .from('picks')
            .select('user_id')
            .eq('games.season_id', seasonId);

        if (usersError) {
            return { error: 'Failed to fetch users' };
        }

        let recalculatedUsers = 0;

        for (const userRow of users || []) {
            const { error } = await supabaseAdmin.rpc('recalculate_user_season_stats', {
                p_user_id: userRow.user_id,
                p_season_id: seasonId
            });

            if (!error) {
                recalculatedUsers++;
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
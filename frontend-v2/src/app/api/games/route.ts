import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentNFLWeek, isGameInCurrentWeek } from '@/lib/nfl-week';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { searchParams } = new URL(request.url);
        const seasonId = searchParams.get('season_id');

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (!seasonId) {
            return NextResponse.json({ error: 'Season ID is required' }, { status: 400 });
        }

        // Verify user has access to this season's league
        const { data: season, error: seasonError } = await supabaseAdmin
            .from('seasons')
            .select(`
                id,
                league_id,
                leagues!inner(
                    id,
                    admin_id,
                    sport_id,
                    sports!inner(name)
                )
            `)
            .eq('id', seasonId)
            .single();

        if (seasonError || !season) {
            return NextResponse.json({ error: 'Season not found' }, { status: 404 });
        }

        // Check if user has access to this league
        const league = Array.isArray(season.leagues) ? season.leagues[0] : season.leagues;
        let hasAccess = league.admin_id === user.id;

        // If not admin, check if user is a member
        if (!hasAccess) {
            const { data: membership, error: membershipError } = await supabaseAdmin
                .from('league_memberships')
                .select('user_id')
                .eq('league_id', season.league_id)
                .eq('user_id', user.id)
                .single();

            hasAccess = !membershipError && !!membership;
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // For NFL leagues, show all current NFL games regardless of which season they're stored in
        let games;
        let gamesError;

        const sport = Array.isArray(league.sports) ? league.sports[0] : league.sports;
        if (sport.name === 'American Football' || sport.name === 'NFL') {
            // Find the current NFL season with games
            const { data: nflSeasonWithGames, error: nflSeasonError } = await supabaseAdmin
                .from('seasons')
                .select(`
                    id,
                    games(
                        id,
                        season_id,
                        home_team_id,
                        away_team_id,
                        start_time,
                        home_score,
                        away_score,
                        status,
                        home_team:teams!games_home_team_id_fkey(
                            name,
                            abbreviation
                        ),
                        away_team:teams!games_away_team_id_fkey(
                            name,
                            abbreviation
                        ),
                        odds(
                            id,
                            sportsbook,
                            last_update,
                            moneyline_home,
                            moneyline_away,
                            spread_home,
                            spread_away,
                            total_over,
                            total_under
                        )
                    )
                `)
                .eq('name', '2025 NFL Season')
                .single();

            if (nflSeasonError || !nflSeasonWithGames) {
                // Fallback to this season's games if no NFL season found
                const { data: fallbackGames, error: fallbackError } = await supabaseAdmin
                    .from('games')
                    .select(`
                        id,
                        season_id,
                        home_team_id,
                        away_team_id,
                        start_time,
                        home_score,
                        away_score,
                        status,
                        home_team:teams!games_home_team_id_fkey(
                            name,
                            abbreviation
                        ),
                        away_team:teams!games_away_team_id_fkey(
                            name,
                            abbreviation
                        ),
                        odds(
                            id,
                            sportsbook,
                            last_update,
                            moneyline_home,
                            moneyline_away,
                            spread_home,
                            spread_away,
                            total_over,
                            total_under
                        )
                    `)
                    .eq('season_id', seasonId)
                    .order('start_time', { ascending: true });

                games = fallbackGames;
                gamesError = fallbackError;
            } else {
                games = nflSeasonWithGames.games;
                gamesError = null;
            }
        } else {
            // For non-NFL leagues, show only this season's games
            const { data: seasonGames, error: seasonGamesError } = await supabaseAdmin
                .from('games')
                .select(`
                    id,
                    season_id,
                    home_team_id,
                    away_team_id,
                    start_time,
                    home_score,
                    away_score,
                    status,
                    home_team:teams!games_home_team_id_fkey(
                        name,
                        abbreviation
                    ),
                    away_team:teams!games_away_team_id_fkey(
                        name,
                        abbreviation
                    ),
                    odds(
                        id,
                        sportsbook,
                        last_update,
                        moneyline_home,
                        moneyline_away,
                        spread_home,
                        spread_away,
                        total_over,
                        total_under
                    )
                `)
                .eq('season_id', seasonId)
                .order('start_time', { ascending: true });

            games = seasonGames;
            gamesError = seasonGamesError;
        }

        if (gamesError) {
            return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
        }

        const currentWeek = getCurrentNFLWeek();

        // Filter games to show current and next week
        const currentWeekGames = games?.filter(game =>
            isGameInCurrentWeek(game.start_time)
        ) || [];

        return NextResponse.json({
            games: currentWeekGames,
            currentWeek,
            totalGames: games?.length || 0
        });

    } catch (err) {
        console.error('API: Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
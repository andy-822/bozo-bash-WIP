import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId } from '@/lib/validation';

interface UserProfile {
  username: string;
  avatar_url: string | null;
}

interface LeaderboardEntry {
  user_id: string;
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  total_points: number;
  current_streak: number;
  best_streak: number;
  worst_streak: number;
  profiles: UserProfile | UserProfile[];
}


export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const seasonId = searchParams.get('season_id');
        const leagueId = searchParams.get('league_id');
        const week = searchParams.get('week');
        const type = searchParams.get('type') || 'season'; // 'season' or 'week'

        const supabase = await createServerSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        if (type === 'season' && seasonId) {
            const seasonValidation = validateId(seasonId, 'Season ID');
            if (!seasonValidation.isValid) {
                return NextResponse.json({ error: seasonValidation.errorMessage }, { status: 400 });
            }

            const leaderboard = await getSeasonLeaderboard(seasonId, user.id);
            return NextResponse.json(leaderboard);
        }

        if (type === 'week' && seasonId && week) {
            const seasonValidation = validateId(seasonId, 'Season ID');
            if (!seasonValidation.isValid) {
                return NextResponse.json({ error: seasonValidation.errorMessage }, { status: 400 });
            }

            const weekValidation = validateId(week, 'Week');
            if (!weekValidation.isValid) {
                return NextResponse.json({ error: weekValidation.errorMessage }, { status: 400 });
            }

            const leaderboard = await getWeeklyLeaderboard(seasonId, parseInt(week), user.id);
            return NextResponse.json(leaderboard);
        }

        if (type === 'league' && leagueId) {
            const leagueValidation = validateId(leagueId, 'League ID');
            if (!leagueValidation.isValid) {
                return NextResponse.json({ error: leagueValidation.errorMessage }, { status: 400 });
            }

            const leaderboard = await getLeagueLeaderboard(leagueId, user.id);
            return NextResponse.json(leaderboard);
        }

        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

    } catch (err) {
        console.error('API: Leaderboard error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function getSeasonLeaderboard(seasonId: string, userId: string) {
    try {
        // Verify user has access to this season
        const { data: access } = await supabaseAdmin
            .from('seasons')
            .select(`
                id,
                league_id,
                leagues!inner(
                    id,
                    league_memberships!inner(user_id)
                )
            `)
            .eq('id', seasonId)
            .eq('leagues.league_memberships.user_id', userId)
            .single();

        if (!access) {
            return { error: 'Season not found or access denied' };
        }

        // Get season leaderboard from aggregated stats
        const { data: leaderboard, error } = await supabaseAdmin
            .from('user_season_stats')
            .select(`
                user_id,
                total_picks,
                wins,
                losses,
                pushes,
                total_points,
                current_streak,
                best_streak,
                worst_streak,
                profiles!inner(username, avatar_url)
            `)
            .eq('season_id', seasonId)
            .order('total_points', { ascending: false })
            .order('wins', { ascending: false })
            .limit(50);

        if (error) {
            return { error: 'Failed to fetch leaderboard' };
        }

        // Calculate additional metrics
        const enhancedLeaderboard = leaderboard?.map((entry: LeaderboardEntry, index: number) => ({
            rank: index + 1,
            user_id: entry.user_id,
            username: Array.isArray(entry.profiles) ? entry.profiles[0]?.username : entry.profiles?.username,
            avatar_url: Array.isArray(entry.profiles) ? entry.profiles[0]?.avatar_url : entry.profiles?.avatar_url,
            total_picks: entry.total_picks,
            wins: entry.wins,
            losses: entry.losses,
            pushes: entry.pushes,
            total_points: entry.total_points,
            win_percentage: entry.total_picks > 0 ? (entry.wins / entry.total_picks * 100).toFixed(1) : '0.0',
            current_streak: entry.current_streak,
            best_streak: entry.best_streak,
            worst_streak: entry.worst_streak,
            is_current_user: entry.user_id === userId
        })) || [];

        return {
            success: true,
            leaderboard: enhancedLeaderboard,
            type: 'season',
            season_id: seasonId
        };

    } catch (error) {
        console.error('Season leaderboard error:', error);
        return { error: 'Failed to generate season leaderboard' };
    }
}

async function getWeeklyLeaderboard(seasonId: string, week: number, userId: string) {
    try {
        // Verify user has access to this season
        const { data: access } = await supabaseAdmin
            .from('seasons')
            .select(`
                id,
                league_id,
                leagues!inner(
                    id,
                    league_memberships!inner(user_id)
                )
            `)
            .eq('id', seasonId)
            .eq('leagues.league_memberships.user_id', userId)
            .single();

        if (!access) {
            return { error: 'Season not found or access denied' };
        }

        // Get weekly performance directly from picks
        const { data: weeklyStats, error } = await supabaseAdmin
            .from('picks')
            .select(`
                user_id,
                result,
                points_awarded,
                profiles!inner(username, avatar_url),
                games!inner(season_id, start_time)
            `)
            .eq('games.season_id', seasonId)
            .eq('week', week)
            .not('result', 'is', null);

        if (error) {
            return { error: 'Failed to fetch weekly stats' };
        }

        // Aggregate weekly stats by user
        const userStats = new Map();

        weeklyStats?.forEach((pick: Record<string, unknown>) => {
            const userId = pick.user_id;
            if (!userStats.has(userId)) {
                userStats.set(userId, {
                    user_id: userId,
                    username: Array.isArray(pick.profiles) ? (pick.profiles[0] as UserProfile)?.username : (pick.profiles as UserProfile)?.username,
                    avatar_url: Array.isArray(pick.profiles) ? (pick.profiles[0] as UserProfile)?.avatar_url : (pick.profiles as UserProfile)?.avatar_url,
                    total_picks: 0,
                    wins: 0,
                    losses: 0,
                    pushes: 0,
                    total_points: 0
                });
            }

            const stats = userStats.get(userId);
            stats.total_picks++;
            stats.total_points += pick.points_awarded || 0;

            if (pick.result === 'win') stats.wins++;
            else if (pick.result === 'loss') stats.losses++;
            else if (pick.result === 'push') stats.pushes++;
        });

        // Convert to array and sort by points, then wins
        const leaderboard = Array.from(userStats.values())
            .sort((a, b) => {
                if (b.total_points !== a.total_points) return b.total_points - a.total_points;
                return b.wins - a.wins;
            })
            .map((entry, index) => ({
                rank: index + 1,
                ...entry,
                win_percentage: entry.total_picks > 0 ? (entry.wins / entry.total_picks * 100).toFixed(1) : '0.0',
                is_current_user: entry.user_id === userId
            }));

        return {
            success: true,
            leaderboard,
            type: 'week',
            season_id: seasonId,
            week: week
        };

    } catch (error) {
        console.error('Weekly leaderboard error:', error);
        return { error: 'Failed to generate weekly leaderboard' };
    }
}

async function getLeagueLeaderboard(leagueId: string, userId: string) {
    try {
        // Verify user has access to this league
        const { data: membership } = await supabaseAdmin
            .from('league_memberships')
            .select('league_id')
            .eq('league_id', leagueId)
            .eq('user_id', userId)
            .single();

        if (!membership) {
            return { error: 'League not found or access denied' };
        }

        // Get all-time league stats across all seasons
        const { data: leagueStats, error } = await supabaseAdmin
            .from('user_season_stats')
            .select(`
                user_id,
                total_picks,
                wins,
                losses,
                pushes,
                total_points,
                best_streak,
                profiles!inner(username, avatar_url),
                seasons!inner(league_id)
            `)
            .eq('seasons.league_id', leagueId);

        if (error) {
            return { error: 'Failed to fetch league stats' };
        }

        // Aggregate stats by user across all seasons
        const userStats = new Map();

        leagueStats?.forEach((stat: Record<string, unknown>) => {
            const userId = stat.user_id;
            if (!userStats.has(userId)) {
                userStats.set(userId, {
                    user_id: userId,
                    username: Array.isArray(stat.profiles) ? (stat.profiles[0] as UserProfile)?.username : (stat.profiles as UserProfile)?.username,
                    avatar_url: Array.isArray(stat.profiles) ? (stat.profiles[0] as UserProfile)?.avatar_url : (stat.profiles as UserProfile)?.avatar_url,
                    total_picks: 0,
                    wins: 0,
                    losses: 0,
                    pushes: 0,
                    total_points: 0,
                    best_streak: 0,
                    seasons_played: 0
                });
            }

            const aggregated = userStats.get(userId);
            aggregated.total_picks += (stat.total_picks as number) || 0;
            aggregated.wins += (stat.wins as number) || 0;
            aggregated.losses += (stat.losses as number) || 0;
            aggregated.pushes += (stat.pushes as number) || 0;
            aggregated.total_points += (stat.total_points as number) || 0;
            aggregated.best_streak = Math.max(aggregated.best_streak, (stat.best_streak as number) || 0);
            aggregated.seasons_played++;
        });

        // Convert to leaderboard
        const leaderboard = Array.from(userStats.values())
            .sort((a, b) => {
                if (b.total_points !== a.total_points) return b.total_points - a.total_points;
                return b.wins - a.wins;
            })
            .map((entry, index) => ({
                rank: index + 1,
                ...entry,
                win_percentage: entry.total_picks > 0 ? (entry.wins / entry.total_picks * 100).toFixed(1) : '0.0',
                average_points_per_season: entry.seasons_played > 0 ? (entry.total_points / entry.seasons_played).toFixed(1) : '0.0',
                is_current_user: entry.user_id === userId
            }));

        return {
            success: true,
            leaderboard,
            type: 'league',
            league_id: leagueId
        };

    } catch (error) {
        console.error('League leaderboard error:', error);
        return { error: 'Failed to generate league leaderboard' };
    }
}
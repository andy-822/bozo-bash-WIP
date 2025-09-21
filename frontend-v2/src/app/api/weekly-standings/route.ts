import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateId } from '@/lib/validation';
import { getLeagueScoringRules } from '@/lib/scoring';

interface WeeklyStanding {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  base_points: number;
  streak_bonus_points: number;
  weekly_winner_bonus: number;
  total_points: number;
  win_percentage: string;
  current_streak: number;
  is_weekly_winner: boolean;
  is_current_user: boolean;
  rank: number;
}

interface WeeklyStandingsResponse {
  success: boolean;
  standings: WeeklyStanding[];
  week: number;
  season_id: string;
  total_participants: number;
  scoring_rules: {
    points_per_win: number;
    points_per_loss: number;
    points_per_push: number;
    streak_bonus: number;
    weekly_winner_bonus: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const week = searchParams.get('week');

    if (!seasonId || !week) {
      return NextResponse.json({ error: 'Season ID and week are required' }, { status: 400 });
    }

    const seasonValidation = validateId(seasonId, 'Season ID');
    if (!seasonValidation.isValid) {
      return NextResponse.json({ error: seasonValidation.errorMessage }, { status: 400 });
    }

    const weekNum = parseInt(week);
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 18) {
      return NextResponse.json({ error: 'Week must be between 1 and 18' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user has access to this season
    const { data: season } = await supabaseAdmin
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
      .eq('leagues.league_memberships.user_id', user.id)
      .single();

    if (!season) {
      return NextResponse.json({ error: 'Season not found or access denied' }, { status: 404 });
    }

    // Get scoring rules for the league
    const scoringRules = await getLeagueScoringRules(season.league_id);

    // Get all picks for this week in this season
    const { data: weeklyPicks, error: picksError } = await supabaseAdmin
      .from('picks')
      .select(`
        user_id,
        result,
        points_awarded,
        created_at,
        profiles!inner(username, avatar_url),
        games!inner(season_id, week)
      `)
      .eq('games.season_id', seasonId)
      .eq('week', weekNum)
      .not('result', 'is', null);

    if (picksError) {
      return NextResponse.json({ error: 'Failed to fetch weekly picks' }, { status: 500 });
    }

    // Calculate weekly standings
    const userStats = new Map<string, {
      user_id: string;
      username: string;
      avatar_url?: string;
      total_picks: number;
      wins: number;
      losses: number;
      pushes: number;
      base_points: number;
      picks: Array<{ result: string; created_at: string; points_awarded: number }>;
    }>();

    // Aggregate picks by user
    weeklyPicks?.forEach((pick: Record<string, unknown>) => {
      const userId = pick.user_id as string;
      if (!userStats.has(userId)) {
        userStats.set(userId, {
          user_id: userId,
          username: Array.isArray(pick.profiles) ? (pick.profiles[0] as {username?: string})?.username || 'Unknown' : (pick.profiles as {username?: string})?.username || 'Unknown',
          avatar_url: Array.isArray(pick.profiles) ? (pick.profiles[0] as {avatar_url?: string})?.avatar_url || undefined : (pick.profiles as {avatar_url?: string})?.avatar_url || undefined,
          total_picks: 0,
          wins: 0,
          losses: 0,
          pushes: 0,
          base_points: 0,
          picks: []
        });
      }

      const stats = userStats.get(userId)!;
      stats.total_picks++;
      stats.base_points += (pick.points_awarded as number) || 0;
      stats.picks.push({
        result: pick.result as string,
        created_at: pick.created_at as string,
        points_awarded: (pick.points_awarded as number) || 0
      });

      if (pick.result === 'win') stats.wins++;
      else if (pick.result === 'loss') stats.losses++;
      else if (pick.result === 'push') stats.pushes++;
    });

    // Calculate streak bonuses and final points
    const standings: WeeklyStanding[] = Array.from(userStats.values()).map(stats => {
      // Calculate current streak for this week
      const sortedPicks = stats.picks
        .filter(p => p.result !== 'pending')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let currentStreak = 0;
      let tempStreak = 0;

      for (const pick of sortedPicks) {
        if (pick.result === 'win') {
          if (tempStreak < 0) tempStreak = 1;
          else tempStreak++;
        } else if (pick.result === 'loss') {
          if (tempStreak > 0) tempStreak = -1;
          else tempStreak--;
        }
        // Push doesn't affect streak
      }
      currentStreak = tempStreak;

      // Calculate streak bonus
      const streakBonusPoints = Math.abs(currentStreak) >= 3 && currentStreak > 0
        ? scoringRules.streak_bonus * Math.floor(Math.abs(currentStreak) / 3)
        : 0;

      const totalPointsBeforeBonus = stats.base_points + streakBonusPoints;

      return {
        user_id: stats.user_id,
        username: stats.username,
        avatar_url: stats.avatar_url,
        total_picks: stats.total_picks,
        wins: stats.wins,
        losses: stats.losses,
        pushes: stats.pushes,
        base_points: stats.base_points,
        streak_bonus_points: streakBonusPoints,
        weekly_winner_bonus: 0, // Will be calculated after sorting
        total_points: totalPointsBeforeBonus,
        win_percentage: stats.total_picks > 0 ? ((stats.wins / stats.total_picks) * 100).toFixed(1) : '0.0',
        current_streak: currentStreak,
        is_weekly_winner: false, // Will be set after sorting
        is_current_user: stats.user_id === user.id,
        rank: 0 // Will be set after sorting
      };
    });

    // Sort by total points (descending), then by wins (descending)
    standings.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return b.wins - a.wins;
    });

    // Assign ranks and determine weekly winner(s)
    let currentRank = 1;
    let previousPoints = -1;
    const weeklyWinners: string[] = [];

    standings.forEach((standing, index) => {
      // Assign rank
      if (previousPoints !== -1 && standing.total_points !== previousPoints) {
        currentRank = index + 1;
      }
      standing.rank = currentRank;
      previousPoints = standing.total_points;

      // Determine weekly winner(s) - top scorers for the week
      if (index === 0 || standing.total_points === standings[0].total_points) {
        standing.is_weekly_winner = true;
        weeklyWinners.push(standing.user_id);
      }
    });

    // Apply weekly winner bonus
    standings.forEach(standing => {
      if (standing.is_weekly_winner && scoringRules.weekly_winner_bonus > 0) {
        standing.weekly_winner_bonus = scoringRules.weekly_winner_bonus;
        standing.total_points += standing.weekly_winner_bonus;
      }
    });

    // Re-sort after adding weekly winner bonus (in case it changes rankings)
    standings.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return b.wins - a.wins;
    });

    // Update ranks again after bonus
    currentRank = 1;
    previousPoints = -1;
    standings.forEach((standing, index) => {
      if (previousPoints !== -1 && standing.total_points !== previousPoints) {
        currentRank = index + 1;
      }
      standing.rank = currentRank;
      previousPoints = standing.total_points;
    });

    return NextResponse.json({
      success: true,
      standings,
      week: weekNum,
      season_id: seasonId,
      total_participants: standings.length,
      scoring_rules: {
        points_per_win: scoringRules.points_per_win,
        points_per_loss: scoringRules.points_per_loss,
        points_per_push: scoringRules.points_per_push,
        streak_bonus: scoringRules.streak_bonus,
        weekly_winner_bonus: scoringRules.weekly_winner_bonus
      }
    } as WeeklyStandingsResponse);

  } catch (err) {
    console.error('API: Weekly standings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface ScoringRules {
  points_per_win: number;
  points_per_loss: number;
  points_per_push: number;
  streak_bonus: number;
  weekly_winner_bonus: number;
}

export interface GameResult {
  home_score: number;
  away_score: number;
  status: string;
}

export interface Pick {
  id: number;
  user_id: string;
  game_id: number;
  bet_type: string;
  selection: string;
  result: string | null;
  points_awarded: number;
  week: number;
}

export interface PickResult {
  result: 'win' | 'loss' | 'push' | 'pending';
  points: number;
  explanation?: string;
}

export type BetType = 'moneyline' | 'spread' | 'total';

/**
 * Enhanced scoring calculator with robust parsing and validation
 */
export class ScoringCalculator {
  private scoringRules: ScoringRules;

  constructor(scoringRules: ScoringRules) {
    this.scoringRules = scoringRules;
  }

  /**
   * Calculate the result and points for a pick
   */
  calculatePick(pick: Pick, gameResult: GameResult): PickResult {
    if (gameResult.status !== 'completed' ||
        gameResult.home_score === null ||
        gameResult.away_score === null) {
      return { result: 'pending', points: 0, explanation: 'Game not completed' };
    }

    try {
      const result = this.determinePickResult(pick, gameResult);
      const points = this.calculatePoints(result);

      return {
        result,
        points,
        explanation: this.getResultExplanation(pick, gameResult, result)
      };
    } catch (error) {
      console.error('Error calculating pick:', error);
      return {
        result: 'pending',
        points: 0,
        explanation: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Determine the result of a pick based on game outcome
   */
  private determinePickResult(pick: Pick, gameResult: GameResult): 'win' | 'loss' | 'push' {
    const { home_score, away_score } = gameResult;

    switch (pick.bet_type.toLowerCase()) {
      case 'moneyline':
        return this.calculateMoneylineResult(pick.selection, home_score, away_score);

      case 'spread':
        return this.calculateSpreadResult(pick.selection, home_score, away_score);

      case 'total':
        return this.calculateTotalResult(pick.selection, home_score, away_score);

      default:
        throw new Error(`Unknown bet type: ${pick.bet_type}`);
    }
  }

  /**
   * Calculate moneyline bet result
   */
  private calculateMoneylineResult(selection: string, homeScore: number, awayScore: number): 'win' | 'loss' | 'push' {
    if (homeScore === awayScore) {
      return 'push';
    }

    const selectionLower = selection.toLowerCase();
    const homeWins = homeScore > awayScore;

    // Handle various selection formats
    if (selectionLower.includes('home') || selectionLower.includes('favorite')) {
      return homeWins ? 'win' : 'loss';
    }

    if (selectionLower.includes('away') || selectionLower.includes('underdog')) {
      return homeWins ? 'loss' : 'win';
    }

    // Handle team name selections (more complex parsing would be needed for production)
    // For now, assume first part is team indicator
    const isHome = selectionLower.startsWith('home') || selectionLower.includes('h:');
    return (isHome && homeWins) || (!isHome && !homeWins) ? 'win' : 'loss';
  }

  /**
   * Calculate spread bet result with robust parsing
   */
  private calculateSpreadResult(selection: string, homeScore: number, awayScore: number): 'win' | 'loss' | 'push' {
    const parsed = this.parseSpreadSelection(selection);
    if (!parsed) {
      throw new Error(`Invalid spread selection format: ${selection}`);
    }

    const { team, spread } = parsed;

    if (team === 'home') {
      const adjustedScore = homeScore + spread;
      if (adjustedScore === awayScore) return 'push';
      return adjustedScore > awayScore ? 'win' : 'loss';
    } else {
      const adjustedScore = awayScore + spread;
      if (adjustedScore === homeScore) return 'push';
      return adjustedScore > homeScore ? 'win' : 'loss';
    }
  }

  /**
   * Calculate total (over/under) bet result
   */
  private calculateTotalResult(selection: string, homeScore: number, awayScore: number): 'win' | 'loss' | 'push' {
    const parsed = this.parseTotalSelection(selection);
    if (!parsed) {
      throw new Error(`Invalid total selection format: ${selection}`);
    }

    const { direction, total } = parsed;
    const gameTotal = homeScore + awayScore;

    if (gameTotal === total) return 'push';

    if (direction === 'over') {
      return gameTotal > total ? 'win' : 'loss';
    } else {
      return gameTotal < total ? 'win' : 'loss';
    }
  }

  /**
   * Parse spread selection into team and spread value
   * Supports formats: "home -7.5", "away +3.5", "h -7", "a +3"
   */
  private parseSpreadSelection(selection: string): { team: 'home' | 'away'; spread: number } | null {
    const cleaned = selection.toLowerCase().trim();

    // Match patterns like: "home -7.5", "away +3.5", "h -7", "a +3"
    const patterns = [
      /^(home|h)\s*([+-]?\d+\.?\d*)$/,
      /^(away|a)\s*([+-]?\d+\.?\d*)$/,
      /^([+-]?\d+\.?\d*)\s*(home|h)$/,
      /^([+-]?\d+\.?\d*)\s*(away|a)$/
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let team: 'home' | 'away';
        let spreadStr: string;

        if (match[1] && (match[1].includes('h') || match[1].includes('a'))) {
          team = match[1].startsWith('h') ? 'home' : 'away';
          spreadStr = match[2];
        } else {
          team = match[2].startsWith('h') ? 'home' : 'away';
          spreadStr = match[1];
        }

        const spread = parseFloat(spreadStr);
        if (!isNaN(spread)) {
          return { team, spread };
        }
      }
    }

    return null;
  }

  /**
   * Parse total selection into direction and total value
   * Supports formats: "over 47.5", "under 45", "o 47.5", "u 45"
   */
  private parseTotalSelection(selection: string): { direction: 'over' | 'under'; total: number } | null {
    const cleaned = selection.toLowerCase().trim();

    // Match patterns like: "over 47.5", "under 45", "o 47.5", "u 45"
    const patterns = [
      /^(over|o)\s*(\d+\.?\d*)$/,
      /^(under|u)\s*(\d+\.?\d*)$/,
      /^(\d+\.?\d*)\s*(over|o)$/,
      /^(\d+\.?\d*)\s*(under|u)$/
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let direction: 'over' | 'under';
        let totalStr: string;

        if (match[1] && (match[1].includes('o') || match[1].includes('u'))) {
          direction = match[1].startsWith('o') ? 'over' : 'under';
          totalStr = match[2];
        } else {
          direction = match[2].startsWith('o') ? 'over' : 'under';
          totalStr = match[1];
        }

        const total = parseFloat(totalStr);
        if (!isNaN(total)) {
          return { direction, total };
        }
      }
    }

    return null;
  }

  /**
   * Calculate points based on result
   */
  private calculatePoints(result: 'win' | 'loss' | 'push'): number {
    switch (result) {
      case 'win':
        return this.scoringRules.points_per_win;
      case 'loss':
        return this.scoringRules.points_per_loss;
      case 'push':
        return this.scoringRules.points_per_push;
      default:
        return 0;
    }
  }

  /**
   * Generate human-readable explanation of the result
   */
  private getResultExplanation(pick: Pick, gameResult: GameResult, result: 'win' | 'loss' | 'push'): string {
    const { home_score, away_score } = gameResult;

    switch (pick.bet_type.toLowerCase()) {
      case 'moneyline':
        if (result === 'push') return `Tie game ${home_score}-${away_score}`;
        const winner = home_score > away_score ? 'Home' : 'Away';
        return `${winner} won ${home_score}-${away_score}, pick: ${pick.selection}`;

      case 'spread':
        const actualSpread = home_score - away_score;
        return `Final: ${home_score}-${away_score} (spread: ${actualSpread > 0 ? '+' : ''}${actualSpread}), pick: ${pick.selection}`;

      case 'total':
        const gameTotal = home_score + away_score;
        return `Total points: ${gameTotal}, pick: ${pick.selection}`;

      default:
        return `${result.toUpperCase()}: ${home_score}-${away_score}`;
    }
  }
}

/**
 * Get scoring rules for a league
 */
export async function getLeagueScoringRules(leagueId: number): Promise<ScoringRules> {
  const { data: rules, error } = await supabaseAdmin
    .from('league_scoring_rules')
    .select('*')
    .eq('league_id', leagueId)
    .single();

  if (error || !rules) {
    // Return default scoring rules
    return {
      points_per_win: 1,
      points_per_loss: 0,
      points_per_push: 0,
      streak_bonus: 0,
      weekly_winner_bonus: 0
    };
  }

  return {
    points_per_win: rules.points_per_win,
    points_per_loss: rules.points_per_loss,
    points_per_push: rules.points_per_push,
    streak_bonus: rules.streak_bonus,
    weekly_winner_bonus: rules.weekly_winner_bonus
  };
}

/**
 * Calculate streak for a user's picks
 */
export function calculateStreak(picks: Pick[]): { current: number; best: number; worst: number } {
  if (picks.length === 0) {
    return { current: 0, best: 0, worst: 0 };
  }

  // Sort picks by creation date (most recent first for current streak)
  const sortedPicks = [...picks]
    .filter(pick => pick.result && pick.result !== 'pending')
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

  let currentStreak = 0;
  let bestStreak = 0;
  let worstStreak = 0;
  let tempStreak = 0;

  // Calculate current streak (from most recent)
  for (const pick of sortedPicks) {
    if (pick.result === 'win') {
      if (currentStreak <= 0) currentStreak = 1;
      else currentStreak++;
    } else if (pick.result === 'loss') {
      if (currentStreak >= 0) currentStreak = -1;
      else currentStreak--;
    }
    // Push doesn't break streak
    break; // Only need first non-push result for current
  }

  // Calculate best and worst streaks (chronological order)
  const chronologicalPicks = sortedPicks.reverse();

  for (const pick of chronologicalPicks) {
    if (pick.result === 'win') {
      if (tempStreak < 0) tempStreak = 1;
      else tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else if (pick.result === 'loss') {
      if (tempStreak > 0) tempStreak = -1;
      else tempStreak--;
      worstStreak = Math.min(worstStreak, tempStreak);
    }
    // Push doesn't affect streak calculation
  }

  return {
    current: currentStreak,
    best: bestStreak,
    worst: worstStreak
  };
}

/**
 * Recalculate user season stats
 */
export async function recalculateUserSeasonStats(userId: string, seasonId: number): Promise<void> {
  // Get all picks for the user in this season
  const { data: picks, error: picksError } = await supabaseAdmin
    .from('picks')
    .select(`
      *,
      games!inner(season_id)
    `)
    .eq('user_id', userId)
    .eq('games.season_id', seasonId)
    .not('result', 'is', null);

  if (picksError) {
    throw new Error(`Failed to fetch picks: ${picksError.message}`);
  }

  const typedPicks = picks as Pick[];

  // Calculate aggregated stats
  const stats = {
    total_picks: typedPicks.length,
    wins: typedPicks.filter(p => p.result === 'win').length,
    losses: typedPicks.filter(p => p.result === 'loss').length,
    pushes: typedPicks.filter(p => p.result === 'push').length,
    total_points: typedPicks.reduce((sum, p) => sum + (p.points_awarded || 0), 0)
  };

  const streaks = calculateStreak(typedPicks);

  // Upsert user season stats
  const { error: upsertError } = await supabaseAdmin
    .from('user_season_stats')
    .upsert({
      user_id: userId,
      season_id: seasonId,
      ...stats,
      current_streak: streaks.current,
      best_streak: streaks.best,
      worst_streak: streaks.worst,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'user_id,season_id'
    });

  if (upsertError) {
    throw new Error(`Failed to update stats: ${upsertError.message}`);
  }
}
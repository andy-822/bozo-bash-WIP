import { useQuery } from '@tanstack/react-query';

export interface WeeklyStanding {
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

export interface WeeklyStandingsResponse {
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

const fetchWeeklyStandings = async (
  seasonId: string,
  week: number
): Promise<WeeklyStandingsResponse> => {
  const response = await fetch(`/api/weekly-standings?season_id=${seasonId}&week=${week}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch weekly standings');
  }

  return data;
};

export const useWeeklyStandings = (seasonId: string, week: number) => {
  return useQuery({
    queryKey: ['weekly-standings', seasonId, week],
    queryFn: () => fetchWeeklyStandings(seasonId, week),
    enabled: !!seasonId && week > 0 && week <= 18,
    staleTime: 1000 * 60 * 2, // 2 minutes - more frequent updates for weekly data
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchInterval: 1000 * 60 * 5, // Auto-refetch every 5 minutes during active use
  });
};

// Helper function to get streak display text
export const getStreakDisplayText = (streak: number): string => {
  if (streak === 0) return 'No streak';
  if (streak > 0) return `W${streak}`;
  return `L${Math.abs(streak)}`;
};

// Helper function to get streak color class
export const getStreakColorClass = (streak: number): string => {
  if (streak === 0) return 'text-gray-500';
  if (streak > 0) return 'text-green-600';
  return 'text-red-600';
};

// Helper function to format points breakdown
export const formatPointsBreakdown = (standing: WeeklyStanding): string => {
  const parts: string[] = [];

  if (standing.base_points > 0) {
    parts.push(`${standing.base_points} base`);
  }

  if (standing.streak_bonus_points > 0) {
    parts.push(`+${standing.streak_bonus_points} streak`);
  }

  if (standing.weekly_winner_bonus > 0) {
    parts.push(`+${standing.weekly_winner_bonus} winner`);
  }

  return parts.length > 0 ? `(${parts.join(', ')})` : '';
};

// Helper function to determine if user is in top 3
export const isTopThree = (rank: number): boolean => {
  return rank <= 3;
};

// Helper function to get rank display
export const getRankDisplay = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `#${rank}`;
  }
};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url?: string;
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  total_points: number;
  win_percentage: string;
  current_streak?: number;
  best_streak: number;
  worst_streak?: number;
  is_current_user: boolean;
  seasons_played?: number;
  average_points_per_season?: string;
}

export interface LeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  type: 'season' | 'week' | 'league';
  season_id?: string;
  league_id?: string;
  week?: number;
}

const fetchLeaderboard = async (
  type: 'season' | 'week' | 'league',
  id: string,
  week?: number
): Promise<LeaderboardResponse> => {
  const params = new URLSearchParams({ type });

  if (type === 'season') {
    params.append('season_id', id);
  } else if (type === 'league') {
    params.append('league_id', id);
  } else if (type === 'week' && week) {
    params.append('season_id', id);
    params.append('week', week.toString());
  }

  const response = await fetch(`/api/leaderboard?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch leaderboard');
  }

  return data;
};

export const useSeasonLeaderboard = (seasonId: string) => {
  return useQuery({
    queryKey: ['leaderboard', 'season', seasonId],
    queryFn: () => fetchLeaderboard('season', seasonId),
    enabled: !!seasonId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useWeeklyLeaderboard = (seasonId: string, week: number) => {
  return useQuery({
    queryKey: ['leaderboard', 'week', seasonId, week],
    queryFn: () => fetchLeaderboard('week', seasonId, week),
    enabled: !!seasonId && week > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes for weekly data
  });
};

export const useLeagueLeaderboard = (leagueId: string) => {
  return useQuery({
    queryKey: ['leaderboard', 'league', leagueId],
    queryFn: () => fetchLeaderboard('league', leagueId),
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 10, // 10 minutes for league-wide data
  });
};

// Scoring operations
const executeScoring = async (action: string, payload: Record<string, unknown>) => {
  const response = await fetch('/api/scoring', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Scoring operation failed');
  }

  return data;
};

export const useCalculateGameResults = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gameId: number) =>
      executeScoring('calculate_game_results', { game_id: gameId }),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });
};

export const useRecalculateSeasonStats = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (seasonId: number) =>
      executeScoring('recalculate_season', { season_id: seasonId }),
    onSuccess: (data, seasonId) => {
      // Invalidate all leaderboard queries for this season
      queryClient.invalidateQueries({
        queryKey: ['leaderboard', 'season', seasonId.toString()]
      });
      queryClient.invalidateQueries({
        queryKey: ['leaderboard', 'week', seasonId.toString()]
      });
    },
  });
};
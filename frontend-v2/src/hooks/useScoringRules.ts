import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ScoringRules {
  id?: number;
  league_id: number;
  points_per_win: number;
  points_per_loss: number;
  points_per_push: number;
  streak_bonus: number;
  weekly_winner_bonus: number;
  created_at?: string;
  updated_at?: string;
}

export interface ScoringRulesResponse {
  success: boolean;
  scoring_rules: ScoringRules;
  message?: string;
}

const fetchScoringRules = async (leagueId: string): Promise<ScoringRulesResponse> => {
  const response = await fetch(`/api/scoring-rules?league_id=${leagueId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch scoring rules');
  }

  return data;
};

const updateScoringRules = async (rules: Partial<ScoringRules> & { league_id: number }): Promise<ScoringRulesResponse> => {
  const response = await fetch('/api/scoring-rules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rules),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update scoring rules');
  }

  return data;
};

const resetScoringRules = async (leagueId: string): Promise<ScoringRulesResponse> => {
  const response = await fetch(`/api/scoring-rules?league_id=${leagueId}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to reset scoring rules');
  }

  return data;
};

export const useScoringRules = (leagueId: string) => {
  return useQuery({
    queryKey: ['scoring-rules', leagueId],
    queryFn: () => fetchScoringRules(leagueId),
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useUpdateScoringRules = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateScoringRules,
    onSuccess: (data, variables) => {
      // Invalidate and refetch scoring rules for this league
      queryClient.invalidateQueries({
        queryKey: ['scoring-rules', variables.league_id.toString()]
      });

      // Also invalidate leaderboards since scoring rules affect points
      queryClient.invalidateQueries({
        queryKey: ['leaderboard']
      });
    },
  });
};

export const useResetScoringRules = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetScoringRules,
    onSuccess: (data, leagueId) => {
      // Invalidate and refetch scoring rules for this league
      queryClient.invalidateQueries({
        queryKey: ['scoring-rules', leagueId]
      });

      // Also invalidate leaderboards since scoring rules affect points
      queryClient.invalidateQueries({
        queryKey: ['leaderboard']
      });
    },
  });
};

// Helper function to get default scoring rules
export const getDefaultScoringRules = (leagueId: number): ScoringRules => ({
  league_id: leagueId,
  points_per_win: 1,
  points_per_loss: 0,
  points_per_push: 0,
  streak_bonus: 0,
  weekly_winner_bonus: 0,
});

// Helper function to validate scoring rules
export const validateScoringRules = (rules: Partial<ScoringRules>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (rules.points_per_win !== undefined && (rules.points_per_win < 0 || rules.points_per_win > 100)) {
    errors.push('Points per win must be between 0 and 100');
  }

  if (rules.points_per_loss !== undefined && (rules.points_per_loss < -10 || rules.points_per_loss > 10)) {
    errors.push('Points per loss must be between -10 and 10');
  }

  if (rules.points_per_push !== undefined && (rules.points_per_push < -5 || rules.points_per_push > 5)) {
    errors.push('Points per push must be between -5 and 5');
  }

  if (rules.streak_bonus !== undefined && (rules.streak_bonus < 0 || rules.streak_bonus > 50)) {
    errors.push('Streak bonus must be between 0 and 50');
  }

  if (rules.weekly_winner_bonus !== undefined && (rules.weekly_winner_bonus < 0 || rules.weekly_winner_bonus > 100)) {
    errors.push('Weekly winner bonus must be between 0 and 100');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
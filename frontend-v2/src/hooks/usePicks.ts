import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Pick {
  id: number;
  game_id: number;
  bet_type: string;
  selection: string;
  result: string | null;
  created_at: string;
  games: {
    id: number;
    start_time: string;
    home_team: { name: string; abbreviation: string };
    away_team: { name: string; abbreviation: string };
  };
}

export interface CreatePickData {
  game_id: number;
  bet_type: string;
  selection: string;
  week: number;
}

export interface LeaguePick {
  id: number;
  user_id: string;
  game_id: number;
  bet_type: string;
  selection: string;
  result: string | null;
  points_awarded: number;
  week: number;
  created_at: string;
  user: {
    username: string;
  };
  games: {
    id: number;
    season_id: number;
    start_time: string;
    status: string;
    home_team: { name: string; abbreviation: string };
    away_team: { name: string; abbreviation: string };
  };
}

const fetchPicks = async (week: number): Promise<Pick[]> => {
  const response = await fetch(`/api/picks?week=${week}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load picks');
  }

  return data.picks || [];
};

const fetchLeaguePicks = async (leagueId: string, week: number): Promise<LeaguePick[]> => {
  const response = await fetch(`/api/league-picks?league_id=${leagueId}&week=${week}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load league picks');
  }

  return data.picks || [];
};

const createPick = async (pickData: CreatePickData): Promise<Pick> => {
  const response = await fetch('/api/picks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pickData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create pick');
  }

  return data.pick;
};

export const usePicks = (week: number) => {
  return useQuery({
    queryKey: ['picks', week],
    queryFn: () => fetchPicks(week),
    enabled: typeof week === 'number',
  });
};

export const useLeaguePicks = (leagueId: string, week: number) => {
  return useQuery({
    queryKey: ['league-picks', leagueId, week],
    queryFn: () => fetchLeaguePicks(leagueId, week),
    enabled: !!leagueId && typeof week === 'number',
  });
};

export const useCreatePick = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPick,
    onSuccess: (data, variables) => {
      // Invalidate picks queries to refetch after creating a pick
      queryClient.invalidateQueries({ queryKey: ['picks', variables.week] });
      queryClient.invalidateQueries({ queryKey: ['league-picks'] });
    },
  });
};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Season {
  id: number;
  name: string;
  league_id: number;
  start_date: string | null;
  end_date: string | null;
}

export interface CreateSeasonData {
  name: string;
  league_id: string;
  start_date?: string;
  end_date?: string;
}

const fetchSeasons = async (leagueId: string): Promise<Season[]> => {
  const response = await fetch(`/api/seasons?league_id=${leagueId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch seasons');
  }

  return data.seasons || [];
};

const createSeason = async (seasonData: CreateSeasonData): Promise<Season> => {
  const response = await fetch('/api/seasons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(seasonData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create season');
  }

  return data.season;
};

export const useSeasons = (leagueId: string) => {
  return useQuery({
    queryKey: ['seasons', leagueId],
    queryFn: () => fetchSeasons(leagueId),
    enabled: !!leagueId,
  });
};

export const useCreateSeason = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSeason,
    onSuccess: (data, variables) => {
      // Invalidate and refetch seasons for the specific league
      queryClient.invalidateQueries({
        queryKey: ['seasons', variables.league_id]
      });
    },
  });
};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface League {
  id: number;
  name: string;
  created_at: string;
  admin_id: string;
  sport_id: number;
  sports: { name: string }[];
}

export interface CreateLeagueData {
  name: string;
  sport_id: number;
}

const fetchLeagues = async (): Promise<League[]> => {
  const response = await fetch('/api/leagues');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch leagues');
  }

  return data.leagues || [];
};

const createLeague = async (leagueData: CreateLeagueData): Promise<League> => {
  const response = await fetch('/api/leagues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(leagueData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create league');
  }

  return data.league;
};

export const useLeagues = () => {
  return useQuery({
    queryKey: ['leagues'],
    queryFn: fetchLeagues,
  });
};

export const useCreateLeague = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLeague,
    onSuccess: () => {
      // Invalidate and refetch leagues after creating a new one
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
  });
};
import { useQuery } from '@tanstack/react-query';

export interface UserWeekPick {
  id: number;
  game_id: number;
  bet_type: string;
  selection: string;
  week: number;
  result: string | null;
  points_awarded: number;
  created_at: string;
}

interface UserWeekPicksResponse {
  picks: UserWeekPick[];
  week: number;
}

const fetchUserWeekPicks = async (seasonId: string, week: number): Promise<UserWeekPicksResponse> => {
  const response = await fetch(`/api/picks?season_id=${seasonId}&week=${week}&user_only=true`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load user picks');
  }

  return {
    picks: data.picks || [],
    week: week
  };
};

export const useUserWeekPicks = (seasonId: string, week: number) => {
  return useQuery({
    queryKey: ['user-week-picks', seasonId, week],
    queryFn: () => fetchUserWeekPicks(seasonId, week),
    enabled: !!seasonId && !!week,
  });
};
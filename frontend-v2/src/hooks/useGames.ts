import { useQuery } from '@tanstack/react-query';

export interface Season {
  id: number;
  name: string;
  league_id: number;
  start_date: string | null;
  end_date: string | null;
  leagues: {
    id: number;
    name: string;
    admin_id: string;
  };
}

export interface Odds {
  id: number;
  sportsbook: string;
  last_update: string;
  moneyline_home: number | null;
  moneyline_away: number | null;
  spread_home: number | null;
  spread_away: number | null;
  total_over: number | null;
  total_under: number | null;
}

export interface Game {
  id: number;
  season_id: number;
  home_team_id: number;
  away_team_id: number;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  home_team: {
    name: string;
    abbreviation: string;
  };
  away_team: {
    name: string;
    abbreviation: string;
  };
  odds: Odds[];
}

export interface GamesResponse {
  games: Game[];
  currentWeek: number;
  totalGames: number;
}

const fetchSeason = async (seasonId: string): Promise<Season> => {
  const response = await fetch(`/api/seasons/${seasonId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load season');
  }

  return data.season;
};

const fetchGames = async (seasonId: string): Promise<GamesResponse> => {
  const response = await fetch(`/api/games?season_id=${seasonId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load games');
  }

  return {
    games: data.games || [],
    currentWeek: data.currentWeek || 1,
    totalGames: data.totalGames || 0,
  };
};

export const useSeason = (seasonId: string) => {
  return useQuery({
    queryKey: ['season', seasonId],
    queryFn: () => fetchSeason(seasonId),
    enabled: !!seasonId,
  });
};

export const useGames = (seasonId: string) => {
  return useQuery({
    queryKey: ['games', seasonId],
    queryFn: () => fetchGames(seasonId),
    enabled: !!seasonId,
  });
};
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

const fetchGamesForWeek = async (seasonId: string, week: number): Promise<GamesResponse> => {
  const response = await fetch(`/api/games?season_id=${seasonId}&week=${week}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load games');
  }

  // Filter games by week on the frontend for now
  const currentWeek = data.currentWeek || 1;
  const allGames = data.games || [];

  // Simple week filtering based on game dates
  // Calculate week based on season start (approximation)
  const weekGames = allGames.filter(game => {
    const gameDate = new Date(game.start_time);
    const seasonStart = new Date(gameDate.getFullYear(), 8, 5); // Sept 5th
    const daysSinceStart = Math.floor((gameDate.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
    const gameWeek = Math.floor(daysSinceStart / 7) + 1;
    return gameWeek === week;
  });

  return {
    games: weekGames,
    currentWeek: currentWeek,
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

export const useGamesForWeek = (seasonId: string, week: number) => {
  return useQuery({
    queryKey: ['games', seasonId, 'week', week],
    queryFn: () => fetchGamesForWeek(seasonId, week),
    enabled: !!seasonId && !!week,
  });
};
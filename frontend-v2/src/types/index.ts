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
  clock?: number;
  display_clock?: string;
  period?: number;
  status_detail?: string;
  last_updated?: string;
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
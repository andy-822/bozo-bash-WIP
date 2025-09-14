export interface User {
  id: string;
  name?: string;
  avatar?: string;
}

export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  gameTime: Date;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  week?: number;
  season?: number;
}

export type BetType = 'moneyline' | 'spread' | 'over' | 'under';

export interface Pick {
  id: string;
  userId: string;
  user: User;
  gameId: string;
  game: Game;
  betType: BetType;
  odds: number;
  selection: string; // e.g., "Chiefs -3.5", "Over 47.5", "Lakers ML"
  status: 'pending' | 'won' | 'lost';
  submittedAt: Date;
  week: number;
  season: number;
}

export interface Parlay {
  id: string;
  userId: string;
  user: User;
  picks: Pick[];
  totalOdds: number;
  potentialWinnings: number;
  status: 'pending' | 'won' | 'lost';
  week: number;
  season: number;
  submittedAt: Date;
}

export interface UserStats {
  userId: string;
  user: User;
  totalParlays: number;
  wins: number;
  losses: number;
  winRate: number;
  totalWinnings: number;
  bestParlay?: Parlay;
  currentStreak: number;
  streakType: 'win' | 'loss';
}

export interface WeekStats {
  week: number;
  season: number;
  totalPicks: number;
  submittedPicks: number;
  completedPicks: number;
  totalPotentialWinnings: number;
}
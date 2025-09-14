import { User, Game, Pick, UserStats, WeekStats } from './types';

export const users: User[] = [
  { id: '1', name: 'Mike "The Sharp" Johnson', avatar: '🎯' },
  { id: '2', name: 'Sarah "Lucky" Chen', avatar: '🍀' },
  { id: '3', name: 'Big Tony', avatar: '🐻' },
  { id: '4', name: 'Rachel the Rocket', avatar: '🚀' },
  { id: '5', name: 'Danny "Fade Me" Wilson', avatar: '📉' },
  { id: '6', name: 'Cold Steve Austin', avatar: '🥶' },
];

export const games: Game[] = [
  {
    id: '1',
    homeTeam: 'Kansas City Chiefs',
    awayTeam: 'Buffalo Bills',
    gameTime: new Date('2024-12-15T20:20:00Z'),
    sport: 'NFL',
    week: 15,
    season: 2024,
  },
  {
    id: '2',
    homeTeam: 'Dallas Cowboys',
    awayTeam: 'Philadelphia Eagles',
    gameTime: new Date('2024-12-15T17:00:00Z'),
    sport: 'NFL',
    week: 15,
    season: 2024,
  },
  {
    id: '3',
    homeTeam: 'Green Bay Packers',
    awayTeam: 'Minnesota Vikings',
    gameTime: new Date('2024-12-16T13:00:00Z'),
    sport: 'NFL',
    week: 15,
    season: 2024,
  },
  {
    id: '4',
    homeTeam: 'Los Angeles Rams',
    awayTeam: 'San Francisco 49ers',
    gameTime: new Date('2024-12-16T16:25:00Z'),
    sport: 'NFL',
    week: 15,
    season: 2024,
  },
  {
    id: '5',
    homeTeam: 'Miami Dolphins',
    awayTeam: 'New York Jets',
    gameTime: new Date('2024-12-17T20:15:00Z'),
    sport: 'NFL',
    week: 15,
    season: 2024,
  },
];

export const picks: Pick[] = [
  {
    id: '1',
    userId: '1',
    user: users[0],
    gameId: '1',
    game: games[0],
    betType: 'spread',
    odds: -110,
    selection: 'Bills +2.5',
    status: 'pending',
    submittedAt: new Date('2024-12-14T10:00:00Z'),
    week: 15,
    season: 2024,
  },
  {
    id: '2',
    userId: '1',
    user: users[0],
    gameId: '2',
    game: games[1],
    betType: 'moneyline',
    odds: -180,
    selection: 'Eagles ML',
    status: 'pending',
    submittedAt: new Date('2024-12-14T10:00:00Z'),
    week: 15,
    season: 2024,
  },
  {
    id: '3',
    userId: '2',
    user: users[1],
    gameId: '1',
    game: games[0],
    betType: 'over',
    odds: -115,
    selection: 'Over 47.5',
    status: 'pending',
    submittedAt: new Date('2024-12-14T14:30:00Z'),
    week: 15,
    season: 2024,
  },
  {
    id: '4',
    userId: '2',
    user: users[1],
    gameId: '3',
    game: games[2],
    betType: 'spread',
    odds: -110,
    selection: 'Packers -3.5',
    status: 'pending',
    submittedAt: new Date('2024-12-14T14:30:00Z'),
    week: 15,
    season: 2024,
  },
  {
    id: '5',
    userId: '3',
    user: users[2],
    gameId: '4',
    game: games[3],
    betType: 'under',
    odds: -105,
    selection: 'Under 44.5',
    status: 'pending',
    submittedAt: new Date('2024-12-14T16:45:00Z'),
    week: 15,
    season: 2024,
  },
];

// Historical data for leaderboard
export const userStats: UserStats[] = [
  {
    userId: '1',
    user: users[0],
    totalParlays: 12,
    wins: 4,
    losses: 8,
    winRate: 33.3,
    totalWinnings: 1240.50,
    currentStreak: 2,
    streakType: 'loss',
  },
  {
    userId: '2',
    user: users[1],
    totalParlays: 11,
    wins: 6,
    losses: 5,
    winRate: 54.5,
    totalWinnings: 2340.75,
    currentStreak: 3,
    streakType: 'win',
  },
  {
    userId: '3',
    user: users[2],
    totalParlays: 9,
    wins: 2,
    losses: 7,
    winRate: 22.2,
    totalWinnings: 580.25,
    currentStreak: 4,
    streakType: 'loss',
  },
  {
    userId: '4',
    user: users[3],
    totalParlays: 10,
    wins: 5,
    losses: 5,
    winRate: 50.0,
    totalWinnings: 1890.00,
    currentStreak: 1,
    streakType: 'win',
  },
  {
    userId: '5',
    user: users[4],
    totalParlays: 13,
    wins: 3,
    losses: 10,
    winRate: 23.1,
    totalWinnings: 720.50,
    currentStreak: 5,
    streakType: 'loss',
  },
  {
    userId: '6',
    user: users[5],
    totalParlays: 8,
    wins: 1,
    losses: 7,
    winRate: 12.5,
    totalWinnings: 180.00,
    currentStreak: 6,
    streakType: 'loss',
  },
];

export const weekStats: WeekStats = {
  week: 15,
  season: 2024,
  totalPicks: 10,
  submittedPicks: 5,
  completedPicks: 0,
  totalPotentialWinnings: 2340.75,
};

// Utility functions
export const calculateParlayOdds = (picks: Pick[]): number => {
  return picks.reduce((total, pick) => {
    const decimal = pick.odds > 0 ? (pick.odds / 100) + 1 : (100 / Math.abs(pick.odds)) + 1;
    return total * decimal;
  }, 1);
};

export const calculatePotentialWinnings = (picks: Pick[], betAmount: number = 10): number => {
  const parlayOdds = calculateParlayOdds(picks);
  return (parlayOdds - 1) * betAmount;
};

export const formatOdds = (odds: number): string => {
  return odds > 0 ? `+${odds}` : `${odds}`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const getPicksByUser = (userId: string): Pick[] => {
  return picks.filter(pick => pick.userId === userId);
};

export const getPicksByWeek = (week: number, season: number): Pick[] => {
  return picks.filter(pick => pick.week === week && pick.season === season);
};
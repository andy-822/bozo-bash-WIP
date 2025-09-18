import { getCurrentNFLWeek } from './nfl-week';

export interface ESPNCompetitor {
  id: string;
  type: 'team';
  order: number;
  homeAway: 'home' | 'away';
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    name: string;
    location: string;
  };
  score: string;
}

export interface ESPNGameStatus {
  clock: number;
  displayClock: string;
  period: number;
  type: {
    id: string;
    name: 'STATUS_SCHEDULED' | 'STATUS_IN_PROGRESS' | 'STATUS_FINAL';
    state: 'pre' | 'in' | 'post';
    completed: boolean;
    description: string;
    detail: string;
    shortDetail: string;
  };
}

export interface ESPNGame {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  season: {
    year: number;
    type: number;
  };
  week: {
    number: number;
  };
  competitions: Array<{
    id: string;
    date: string;
    competitors: ESPNCompetitor[];
    status: ESPNGameStatus;
    venue: {
      id: string;
      fullName: string;
    };
  }>;
}

export interface ESPNScoreboardResponse {
  leagues: Array<{
    id: string;
    name: string;
    season: {
      year: number;
      type: number;
    };
  }>;
  season: {
    type: number;
    year: number;
  };
  week: {
    number: number;
  };
  events: ESPNGame[];
}

export interface ProcessedGameData {
  espnGameId: string;
  homeTeam: {
    abbreviation: string;
    score: number | null;
  };
  awayTeam: {
    abbreviation: string;
    score: number | null;
  };
  status: {
    name: string;
    state: string;
    completed: boolean;
  };
  startTime: string;
}

/**
 * Fetch current week's games from ESPN API
 */
export async function fetchESPNScoreboard(week?: number): Promise<ESPNScoreboardResponse> {
  const currentWeek = week || getCurrentNFLWeek();
  const url = `http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${currentWeek}`;

  console.log(`Fetching ESPN scoreboard for week ${currentWeek}:`, url);

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParlayChallenge/1.0)',
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    console.log(`ESPN API response received in ${responseTime}ms:`, {
      gamesFound: data.events?.length || 0,
      week: data.week?.number,
      season: data.season?.year,
    });

    return data;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`ESPN API fetch failed after ${responseTime}ms:`, error);
    throw error;
  }
}

/**
 * Process ESPN games data into our format
 */
export function processESPNGames(espnData: ESPNScoreboardResponse): ProcessedGameData[] {
  if (!espnData.events || espnData.events.length === 0) {
    return [];
  }

  return espnData.events.map(event => {
    const competition = event.competitions[0];
    const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

    return {
      espnGameId: event.id,
      homeTeam: {
        abbreviation: homeTeam?.team.abbreviation || '',
        score: homeTeam ? parseInt(homeTeam.score) || null : null,
      },
      awayTeam: {
        abbreviation: awayTeam?.team.abbreviation || '',
        score: awayTeam ? parseInt(awayTeam.score) || null : null,
      },
      status: {
        name: competition.status.type.name,
        state: competition.status.type.state,
        completed: competition.status.type.completed,
      },
      startTime: event.date,
    };
  });
}

/**
 * Get only completed games from ESPN data
 */
export function getCompletedGames(games: ProcessedGameData[]): ProcessedGameData[] {
  return games.filter(game => game.status.completed);
}

/**
 * Get only live/in-progress games from ESPN data
 */
export function getLiveGames(games: ProcessedGameData[]): ProcessedGameData[] {
  return games.filter(game =>
    game.status.state === 'in' && !game.status.completed
  );
}

/**
 * Log ESPN API call to database for monitoring
 */
export async function logESPNAPICall(
  endpoint: string,
  week: number,
  statusCode: number,
  gamesFound: number,
  completedGames: number,
  newlyCompleted: number,
  responseTimeMs: number,
  errorMessage?: string
) {
  // This would be called from the API route where we have access to supabase
  const logData = {
    endpoint,
    week,
    status_code: statusCode,
    games_found: gamesFound,
    completed_games: completedGames,
    newly_completed: newlyCompleted,
    response_time_ms: responseTimeMs,
    error_message: errorMessage || null,
  };

  console.log('ESPN API call logged:', logData);
  return logData;
}
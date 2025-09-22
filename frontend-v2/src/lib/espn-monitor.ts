import { getCurrentNFLWeek } from './nfl-week';
import { supabaseAdmin } from './supabase-admin';

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
    color?: string;
    alternateColor?: string;
    logo?: string;
    venue?: {
      id: string;
      fullName?: string;
    };
    links?: Array<{
      rel: string[];
      href: string;
      text: string;
    }>;
  };
  score: string;
  records?: Array<{
    name: string;
    type: string;
    summary: string;
  }>;
  leaders?: Array<{
    name: string;
    displayName: string;
    abbreviation: string;
    leaders: Array<{
      displayValue: string;
      value: number;
      athlete: {
        id: string;
        fullName: string;
        displayName: string;
        shortName: string;
        headshot?: string;
        jersey?: string;
        position: {
          abbreviation: string;
        };
      };
    }>;
  }>;
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
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${currentWeek}`;

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParlayChallenge/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    // Log only essential info
    console.log(`ESPN week ${currentWeek}: ${data.events?.length || 0} games (${responseTime}ms)`);

    return data;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`ESPN API failed for week ${currentWeek} (${responseTime}ms):`, error);
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
 * Extract and update team information from ESPN data
 */
export async function updateTeamInformationFromESPN(espnData: ESPNScoreboardResponse): Promise<void> {
  if (!espnData.events || espnData.events.length === 0) {
    return;
  }

  const teamUpdates = new Map<string, {
    espn_team_id: string;
    abbreviation: string;
    primary_color?: string | null;
    alternate_color?: string | null;
    logo_url?: string | null;
    venue_name?: string | null;
    venue_id?: string | null;
    current_record?: string | null;
    home_record?: string | null;
    away_record?: string | null;
    last_updated: string;
    leaders?: Array<{
      name: string;
      leaders?: Array<{
        athlete: {
          id: string;
          fullName: string;
          position?: {
            abbreviation: string;
          };
          jersey?: string;
          headshot?: string;
        };
        displayValue?: string;
        value?: number;
      }>;
    }>;
  }>();

  // Collect all unique teams from all games
  for (const event of espnData.events) {
    const competition = event.competitions[0];

    for (const competitor of competition.competitors) {
      const team = competitor.team;
      const teamAbbr = team.abbreviation;

      if (!teamUpdates.has(teamAbbr)) {
        teamUpdates.set(teamAbbr, {
          abbreviation: teamAbbr,
          espn_team_id: team.id,
          primary_color: team.color ? `#${team.color}` : null,
          alternate_color: team.alternateColor ? `#${team.alternateColor}` : null,
          logo_url: team.logo || null,
          venue_name: team.venue?.fullName || competition.venue?.fullName || null,
          venue_id: team.venue?.id || competition.venue?.id || null,
          current_record: competitor.records?.find(r => r.name === 'overall')?.summary || null,
          home_record: competitor.records?.find(r => r.type === 'home')?.summary || null,
          away_record: competitor.records?.find(r => r.type === 'road')?.summary || null,
          last_updated: new Date().toISOString(),
        });

        // Store team stats/leaders for separate processing
        if (competitor.leaders && competitor.leaders.length > 0) {
          teamUpdates.get(teamAbbr)!.leaders = competitor.leaders;
        }
      }
    }
  }

  // Update teams in database
  for (const [abbreviation, teamData] of teamUpdates) {
    try {
      // Update team information
      const { data: updatedTeam, error: teamError } = await supabaseAdmin
        .from('teams')
        .update({
          espn_team_id: teamData.espn_team_id,
          primary_color: teamData.primary_color,
          alternate_color: teamData.alternate_color,
          logo_url: teamData.logo_url,
          venue_name: teamData.venue_name,
          venue_id: teamData.venue_id,
          current_record: teamData.current_record,
          home_record: teamData.home_record,
          away_record: teamData.away_record,
          last_updated: teamData.last_updated,
        })
        .eq('abbreviation', abbreviation)
        .select('id')
        .single();

      if (teamError) {
        console.error(`Failed to update team ${abbreviation}:`, teamError);
        continue;
      }

      // Update team statistical leaders if available
      if (teamData.leaders && updatedTeam) {
        await updateTeamStatistics(updatedTeam.id, teamData.leaders);
      }

    } catch (error) {
      console.error(`Error processing team ${abbreviation}:`, error);
    }
  }

  console.log(`Updated ${teamUpdates.size} teams with ESPN data`);
}

/**
 * Update team statistical leaders in database
 */
async function updateTeamStatistics(teamId: number, leaders: Array<{
  name: string;
  leaders?: Array<{
    athlete: {
      id: string;
      fullName: string;
      position?: {
        abbreviation: string;
      };
      jersey?: string;
      headshot?: string;
    };
    displayValue?: string;
    value?: number;
  }>;
}>): Promise<void> {
  for (const leader of leaders) {
    if (!leader.leaders || leader.leaders.length === 0) continue;

    const topLeader = leader.leaders[0]; // Get the top performer
    const athlete = topLeader.athlete;

    try {
      await supabaseAdmin
        .from('team_stats')
        .upsert({
          team_id: teamId,
          stat_type: leader.name, // 'passingLeader', 'rushingLeader', 'receivingLeader'
          athlete_id: athlete.id,
          athlete_name: athlete.fullName,
          athlete_position: athlete.position?.abbreviation,
          athlete_jersey: athlete.jersey,
          athlete_headshot: athlete.headshot,
          display_value: topLeader.displayValue,
          numeric_value: topLeader.value,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'team_id,stat_type',
        });
    } catch (error) {
      console.error(`Failed to update team stats for team ${teamId}:`, error);
    }
  }
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

  try {
    await supabaseAdmin.from('espn_api_calls').insert(logData);
  } catch (error) {
    console.error('Failed to log ESPN API call:', error);
  }

  return logData;
}

/**
 * Enhanced game data structure for complete season management
 */
export interface EnhancedESPNGame extends ProcessedGameData {
  venue: {
    name: string;
    city: string;
    state: string;
  };
  week: number;
  season: {
    year: number;
    type: number;
  };
  espnEventName: string;
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Fetch complete season schedule from ESPN (weeks 1-18)
 * This is the core function for the new architecture
 */
export async function fetchCompleteESPNSeason(): Promise<{
  games: EnhancedESPNGame[];
  summary: {
    totalGames: number;
    weeklyBreakdown: Record<number, number>;
    season: { year: number; type: number };
    fetchTime: number;
  };
}> {
  const startTime = Date.now();

  const allGames: EnhancedESPNGame[] = [];
  const weeklyBreakdown: Record<number, number> = {};
  let seasonInfo: { year: number; type: number } | null = null;

  // Fetch all weeks with small delays to respect rate limits
  for (let week = 1; week <= 18; week++) {
    try {

      const weekData = await fetchESPNScoreboard(week);
      const enhancedGames = processEnhancedESPNGames(weekData);

      allGames.push(...enhancedGames);
      weeklyBreakdown[week] = enhancedGames.length;

      // Capture season info from the first successful response
      if (!seasonInfo && weekData.season) {
        seasonInfo = weekData.season;
      }

      // Small delay to avoid overwhelming ESPN API
      if (week < 18) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error(`Failed to fetch week ${week}:`, error);
      weeklyBreakdown[week] = 0;

      // Log the failed attempt
      await logESPNAPICall(
        `/apis/site/v2/sports/football/nfl/scoreboard?week=${week}`,
        week,
        0,
        0,
        0,
        0,
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Continue with other weeks rather than failing completely
    }
  }

  const fetchTime = Date.now() - startTime;
  console.log(`ESPN season complete: ${allGames.length} games in ${Math.round(fetchTime/1000)}s`);

  return {
    games: allGames,
    summary: {
      totalGames: allGames.length,
      weeklyBreakdown,
      season: seasonInfo || { year: new Date().getFullYear(), type: 2 },
      fetchTime,
    },
  };
}

/**
 * Process ESPN games data into enhanced format with venue and team info
 */
export function processEnhancedESPNGames(espnData: ESPNScoreboardResponse): EnhancedESPNGame[] {
  if (!espnData.events || espnData.events.length === 0) {
    return [];
  }

  return espnData.events.map(event => {
    const competition = event.competitions[0];
    const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) {
      throw new Error(`Invalid game data for ESPN game ${event.id}: missing team data`);
    }

    return {
      espnGameId: event.id,
      espnEventName: event.name,
      homeTeam: {
        abbreviation: homeTeam.team.abbreviation,
        score: homeTeam.score ? parseInt(homeTeam.score) || null : null,
      },
      awayTeam: {
        abbreviation: awayTeam.team.abbreviation,
        score: awayTeam.score ? parseInt(awayTeam.score) || null : null,
      },
      status: {
        name: competition.status.type.name,
        state: competition.status.type.state,
        completed: competition.status.type.completed,
      },
      startTime: event.date,
      venue: {
        name: competition.venue.fullName,
        city: (competition.venue as { address?: { city?: string } }).address?.city || '',
        state: (competition.venue as { address?: { state?: string } }).address?.state || '',
      },
      week: event.week.number,
      season: event.season,
      homeTeamId: homeTeam.team.id,
      awayTeamId: awayTeam.team.id,
    };
  });
}

/**
 * Team name mapping for odds APIs to ESPN abbreviations
 */
export const TEAM_NAME_MAPPING: Record<string, string> = {
  // AFC East
  'Buffalo Bills': 'BUF',
  'Miami Dolphins': 'MIA',
  'New England Patriots': 'NE',
  'New York Jets': 'NYJ',

  // AFC North
  'Baltimore Ravens': 'BAL',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Pittsburgh Steelers': 'PIT',

  // AFC South
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Tennessee Titans': 'TEN',

  // AFC West
  'Denver Broncos': 'DEN',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',

  // NFC East
  'Dallas Cowboys': 'DAL',
  'New York Giants': 'NYG',
  'Philadelphia Eagles': 'PHI',
  'Washington Commanders': 'WSH',

  // NFC North
  'Chicago Bears': 'CHI',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Minnesota Vikings': 'MIN',

  // NFC South
  'Atlanta Falcons': 'ATL',
  'Carolina Panthers': 'CAR',
  'New Orleans Saints': 'NO',
  'Tampa Bay Buccaneers': 'TB',

  // NFC West
  'Arizona Cardinals': 'ARI',
  'Los Angeles Rams': 'LAR',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
};

/**
 * Reverse mapping from ESPN abbreviations to full team names
 */
export const ESPN_TO_FULL_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_NAME_MAPPING).map(([fullName, abbr]) => [abbr, fullName])
);

/**
 * Find ESPN game by team abbreviations and date
 */
export function findESPNGameByTeamsAndDate(
  games: EnhancedESPNGame[],
  homeTeam: string,
  awayTeam: string,
  gameDate: Date
): EnhancedESPNGame | null {
  const targetDate = gameDate.toISOString().split('T')[0]; // YYYY-MM-DD format

  return games.find(game => {
    const gameDate = new Date(game.startTime).toISOString().split('T')[0];
    return (
      gameDate === targetDate &&
      game.homeTeam.abbreviation === homeTeam &&
      game.awayTeam.abbreviation === awayTeam
    );
  }) || null;
}
import { supabaseAdmin } from './supabase-admin';
import { TEAM_NAME_MAPPING } from './espn-monitor';

/**
 * Game Matching Algorithm for Odds Attachment
 *
 * This module implements Phase 2 of the Game Architecture Refactor:
 * Intelligent matching of odds from external APIs to existing ESPN games
 */

export interface OddsSourceGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  sport?: string;
  source: string; // 'odds_api', 'espn_bet', etc.
}

export interface DatabaseGame {
  id: number;
  espn_game_id: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  start_time: string;
  week: number;
  status: string;
}

export interface GameMatchResult {
  databaseGame: DatabaseGame;
  oddsGame: OddsSourceGame;
  confidence: number; // 0-100
  matchType: 'exact' | 'fuzzy' | 'manual';
  matchReasons: string[];
}

export interface MatchingSummary {
  totalOddsGames: number;
  matchedGames: number;
  unmatchedGames: number;
  highConfidenceMatches: number;
  lowConfidenceMatches: number;
  matches: GameMatchResult[];
  unmatchedOddsGames: OddsSourceGame[];
}

/**
 * Main game matching function
 * Attempts to match odds games to existing ESPN games in the database
 */
export async function matchOddsGamesToESPNGames(
  oddsGames: OddsSourceGame[],
  options: {
    confidenceThreshold?: number; // Default 80
    timeToleranceHours?: number; // Default 6 hours
    enableFuzzyMatching?: boolean; // Default true
  } = {}
): Promise<MatchingSummary> {
  const {
    confidenceThreshold = 80,
    timeToleranceHours = 6,
    enableFuzzyMatching = true,
  } = options;

  console.log(`Starting game matching for ${oddsGames.length} odds games...`);

  // Fetch all current season games from database
  const databaseGames = await fetchCurrentSeasonGames();
  console.log(`Found ${databaseGames.length} games in database`);

  const matches: GameMatchResult[] = [];
  const unmatchedOddsGames: OddsSourceGame[] = [];

  for (const oddsGame of oddsGames) {
    const matchResult = await findBestMatch(
      oddsGame,
      databaseGames,
      { timeToleranceHours, enableFuzzyMatching }
    );

    if (matchResult && matchResult.confidence >= confidenceThreshold) {
      matches.push(matchResult);
    } else {
      unmatchedOddsGames.push(oddsGame);
    }
  }

  const highConfidenceMatches = matches.filter(m => m.confidence >= 95).length;
  const lowConfidenceMatches = matches.filter(m => m.confidence < 95).length;

  console.log(`Matching complete: ${matches.length} matched, ${unmatchedOddsGames.length} unmatched`);

  return {
    totalOddsGames: oddsGames.length,
    matchedGames: matches.length,
    unmatchedGames: unmatchedOddsGames.length,
    highConfidenceMatches,
    lowConfidenceMatches,
    matches,
    unmatchedOddsGames,
  };
}

/**
 * Find the best matching database game for an odds game
 */
async function findBestMatch(
  oddsGame: OddsSourceGame,
  databaseGames: DatabaseGame[],
  options: {
    timeToleranceHours: number;
    enableFuzzyMatching: boolean;
  }
): Promise<GameMatchResult | null> {
  const { timeToleranceHours, enableFuzzyMatching } = options;

  // Convert odds team names to ESPN abbreviations
  const homeAbbr = mapTeamNameToESPNAbbreviation(oddsGame.homeTeam);
  const awayAbbr = mapTeamNameToESPNAbbreviation(oddsGame.awayTeam);

  if (!homeAbbr || !awayAbbr) {
    console.warn(`Could not map team names: ${oddsGame.homeTeam} vs ${oddsGame.awayTeam}`);
    return null;
  }

  const oddsGameTime = new Date(oddsGame.commenceTime);
  const bestMatches: Array<{ game: DatabaseGame; score: number; reasons: string[] }> = [];

  for (const dbGame of databaseGames) {
    const gameTime = new Date(dbGame.start_time);
    const timeDiffHours = Math.abs(gameTime.getTime() - oddsGameTime.getTime()) / (1000 * 60 * 60);

    // Skip if time difference is too large
    if (timeDiffHours > timeToleranceHours) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];

    // Exact team match (highest score)
    if (
      dbGame.home_team_abbreviation === homeAbbr &&
      dbGame.away_team_abbreviation === awayAbbr
    ) {
      score += 50;
      reasons.push('Exact team match');
    }
    // Reversed team match (teams swapped)
    else if (
      dbGame.home_team_abbreviation === awayAbbr &&
      dbGame.away_team_abbreviation === homeAbbr
    ) {
      score += 40;
      reasons.push('Reversed team match');
    }
    // Fuzzy matching if enabled
    else if (enableFuzzyMatching) {
      if (
        (dbGame.home_team_abbreviation === homeAbbr || dbGame.away_team_abbreviation === homeAbbr) &&
        (dbGame.home_team_abbreviation === awayAbbr || dbGame.away_team_abbreviation === awayAbbr)
      ) {
        score += 30;
        reasons.push('Partial team match');
      }
    }

    // Time proximity scoring
    if (timeDiffHours <= 1) {
      score += 30;
      reasons.push('Very close time match (±1 hour)');
    } else if (timeDiffHours <= 3) {
      score += 20;
      reasons.push('Close time match (±3 hours)');
    } else if (timeDiffHours <= 6) {
      score += 10;
      reasons.push('Reasonable time match (±6 hours)');
    }

    // Same day bonus
    if (
      gameTime.toDateString() === oddsGameTime.toDateString()
    ) {
      score += 10;
      reasons.push('Same day');
    }

    if (score > 0) {
      bestMatches.push({ game: dbGame, score, reasons });
    }
  }

  // Sort by score and take the best match
  bestMatches.sort((a, b) => b.score - a.score);
  const bestMatch = bestMatches[0];

  if (!bestMatch) {
    return null;
  }

  // Calculate confidence percentage
  const maxPossibleScore = 90; // 50 (exact teams) + 30 (very close time) + 10 (same day)
  const confidence = Math.min(100, Math.round((bestMatch.score / maxPossibleScore) * 100));

  // Determine match type
  let matchType: 'exact' | 'fuzzy' | 'manual' = 'manual';
  if (confidence >= 95) {
    matchType = 'exact';
  } else if (confidence >= 70) {
    matchType = 'fuzzy';
  }

  return {
    databaseGame: bestMatch.game,
    oddsGame,
    confidence,
    matchType,
    matchReasons: bestMatch.reasons,
  };
}

/**
 * Map team name from odds API to ESPN abbreviation
 */
function mapTeamNameToESPNAbbreviation(teamName: string): string | null {
  // Direct mapping from team name
  if (TEAM_NAME_MAPPING[teamName]) {
    return TEAM_NAME_MAPPING[teamName];
  }

  // Try to find partial matches
  const lowerTeamName = teamName.toLowerCase();

  // Handle common variations
  const variations: Record<string, string> = {
    'las vegas raiders': 'LV',
    'la raiders': 'LV',
    'oakland raiders': 'LV',
    'los angeles chargers': 'LAC',
    'la chargers': 'LAC',
    'san diego chargers': 'LAC',
    'los angeles rams': 'LAR',
    'la rams': 'LAR',
    'st. louis rams': 'LAR',
    'washington commanders': 'WSH',
    'washington football team': 'WSH',
    'washington redskins': 'WSH',
    'new york giants': 'NYG',
    'ny giants': 'NYG',
    'new york jets': 'NYJ',
    'ny jets': 'NYJ',
    'new england patriots': 'NE',
    'tampa bay buccaneers': 'TB',
    'green bay packers': 'GB',
    'san francisco 49ers': 'SF',
  };

  if (variations[lowerTeamName]) {
    return variations[lowerTeamName];
  }

  // Search for partial matches in the mapping
  for (const [fullName, abbr] of Object.entries(TEAM_NAME_MAPPING)) {
    if (
      fullName.toLowerCase().includes(lowerTeamName) ||
      lowerTeamName.includes(fullName.toLowerCase())
    ) {
      return abbr;
    }
  }

  console.warn(`Could not map team name: ${teamName}`);
  return null;
}

/**
 * Fetch current season games from database
 */
async function fetchCurrentSeasonGames(): Promise<DatabaseGame[]> {
  const currentYear = new Date().getFullYear();
  const seasonName = `${currentYear} NFL Season`;

  const { data: games, error } = await supabaseAdmin
    .from('games')
    .select(`
      id,
      espn_game_id,
      start_time,
      week,
      status,
      home_team:teams!games_home_team_id_fkey(abbreviation),
      away_team:teams!games_away_team_id_fkey(abbreviation),
      seasons!inner(name)
    `)
    .eq('seasons.name', seasonName);

  if (error) {
    console.error('Failed to fetch games:', error);
    throw new Error(`Failed to fetch database games: ${error.message}`);
  }

  return (games || []).map(game => ({
    id: game.id,
    espn_game_id: game.espn_game_id,
    home_team_abbreviation: Array.isArray(game.home_team)
      ? game.home_team[0]?.abbreviation
      : (game.home_team as { abbreviation?: string })?.abbreviation,
    away_team_abbreviation: Array.isArray(game.away_team)
      ? game.away_team[0]?.abbreviation
      : (game.away_team as { abbreviation?: string })?.abbreviation,
    start_time: game.start_time,
    week: game.week,
    status: game.status,
  }));
}

/**
 * Store game matching results in the database for tracking
 */
export async function storeGameMatchingResults(
  matches: GameMatchResult[],
  source: string
): Promise<void> {
  const mappingRecords = matches.map(match => ({
    game_id: match.databaseGame.id,
    source_type: source,
    source_game_id: match.oddsGame.id,
    home_team_source: match.oddsGame.homeTeam,
    away_team_source: match.oddsGame.awayTeam,
    confidence_score: match.confidence,
  }));

  if (mappingRecords.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('odds_source_mapping')
    .upsert(mappingRecords, {
      onConflict: 'game_id,source_type,source_game_id',
    });

  if (error) {
    console.error('Failed to store game matching results:', error);
    throw new Error(`Failed to store matching results: ${error.message}`);
  }

  console.log(`Stored ${mappingRecords.length} game matching results`);
}

/**
 * Get matching statistics for monitoring
 */
export async function getMatchingStatistics(): Promise<{
  totalMappings: number;
  sourceBreakdown: Record<string, number>;
  averageConfidence: number;
  highConfidenceCount: number;
}> {
  const { data: mappings, error } = await supabaseAdmin
    .from('odds_source_mapping')
    .select('source_type, confidence_score');

  if (error) {
    throw new Error(`Failed to get matching statistics: ${error.message}`);
  }

  if (!mappings || mappings.length === 0) {
    return {
      totalMappings: 0,
      sourceBreakdown: {},
      averageConfidence: 0,
      highConfidenceCount: 0,
    };
  }

  const sourceBreakdown: Record<string, number> = {};
  let totalConfidence = 0;
  let highConfidenceCount = 0;

  for (const mapping of mappings) {
    sourceBreakdown[mapping.source_type] = (sourceBreakdown[mapping.source_type] || 0) + 1;
    totalConfidence += mapping.confidence_score;
    if (mapping.confidence_score >= 90) {
      highConfidenceCount++;
    }
  }

  return {
    totalMappings: mappings.length,
    sourceBreakdown,
    averageConfidence: Math.round(totalConfidence / mappings.length),
    highConfidenceCount,
  };
}
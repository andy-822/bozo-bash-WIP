import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rateLimitESPNIngest } from '@/lib/rate-limit';
import {
  safeDbOperation,
  validateDbResult,
  ContextualError
} from '@/lib/error-handling';
import {
  fetchCompleteESPNSeason,
  EnhancedESPNGame,
  ESPN_TO_FULL_NAME,
} from '@/lib/espn-monitor';

// Removed unused interfaces - keeping imports clean

/**
 * ESPN Season Ingestion API
 * POST /api/espn/ingest-season
 *
 * This endpoint implements Phase 1 of the Game Architecture Refactor:
 * - Fetches complete NFL season schedule from ESPN (weeks 1-18)
 * - Creates/updates teams with ESPN data
 * - Populates games table with ESPN as the authoritative source
 * - Sets up ESPN game IDs as primary references
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimitESPNIngest(ip);

    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: 'Too many requests',
        message: 'Rate limit exceeded for ESPN season ingestion endpoint',
        reset: new Date(rateLimitResult.reset).toISOString()
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString()
        }
      });
    }

    // CRON secret validation (optional but recommended)
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '') ||
                          request.headers.get('x-cron-secret');

    if (cronSecret && providedSecret && providedSecret !== cronSecret) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Invalid CRON secret'
      }, { status: 401 });
    }

    // Require authentication for production security
    if (!cronSecret) {
      return NextResponse.json({
        error: 'Configuration Error',
        message: 'CRON_SECRET environment variable must be configured'
      }, { status: 500 });
    }

    if (!providedSecret) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'CRON secret required. Provide via Authorization header or x-cron-secret header'
      }, { status: 401 });
    }

    // 1. Fetch complete season data from ESPN
    const seasonData = await fetchCompleteESPNSeason();

    if (seasonData.games.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No games found in ESPN season data',
        message: 'ESPN API may be unavailable or season not yet available'
      }, { status: 500 });
    }

    // 2. Ensure we have the necessary sport and season records
    const { sportId, seasonId } = await ensureNFLSeasonSetup();

    // 3. Process all teams from ESPN data
    await ensureAllTeamsFromESPN(seasonData.games, sportId);

    // 4. Ingest all games
    const ingestionResults = await ingestGamesFromESPN(seasonData.games, seasonId);

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'ESPN season ingestion completed successfully',
      timestamp: new Date().toISOString(),
      summary: {
        totalGames: seasonData.games.length,
        weeklyBreakdown: seasonData.summary.weeklyBreakdown,
        season: seasonData.summary.season,
        ingestionResults,
        processingTime: {
          espnFetchTime: seasonData.summary.fetchTime,
          totalTime,
        },
      },
    });

  } catch (error) {
    console.error('ESPN season ingestion failed:', error);

    return NextResponse.json({
      success: false,
      error: 'ESPN season ingestion failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Ensure NFL sport and season exist with comprehensive error handling
 */
async function ensureNFLSeasonSetup(): Promise<{ sportId: number; seasonId: number }> {
  // Step 1: Ensure we have an NFL sport
  const sportResult = await safeDbOperation(
    async () => {
      const { data, error } = await supabaseAdmin
        .from('sports')
        .select('id')
        .eq('name', 'NFL')
        .single();

      if (error || !data) {
        // Create NFL sport if it doesn't exist
        const { data: newSport, error: createError } = await supabaseAdmin
          .from('sports')
          .insert({ name: 'NFL' })
          .select('id')
          .single();

        if (createError || !newSport) {
          throw new ContextualError(
            'Failed to create NFL sport',
            { operation: 'create_nfl_sport', additionalInfo: { data: { createError } } },
            createError
          );
        }

        return newSport;
      }

      return data;
    },
    { operation: 'ensure_nfl_sport' },
    // Fallback: Try to find any sport to use temporarily
    async () => {
      console.warn('Attempting fallback: using any available sport');
      const { data: anySport, error } = await supabaseAdmin
        .from('sports')
        .select('id')
        .limit(1)
        .single();

      if (error || !anySport) {
        throw new ContextualError(
          'No sports exist in the system',
          { operation: 'fallback_any_sport' }
        );
      }

      return anySport;
    }
  );

  if (!sportResult.success || !sportResult.data) {
    throw new ContextualError(
      'Failed to ensure NFL sport exists',
      {
        operation: 'ensure_nfl_sport_complete',
        additionalInfo: {
          error: sportResult.error,
          details: sportResult.details
        }
      }
    );
  }

  const nflSport = validateDbResult(
    sportResult.data,
    ['id'],
    { operation: 'validate_nfl_sport' }
  );

  if (!nflSport.success || !nflSport.data) {
    throw new ContextualError(
      'NFL sport data is malformed',
      {
        operation: 'validate_nfl_sport',
        data: sportResult.data,
        additionalInfo: { error: nflSport.error }
      }
    );
  }

  const sportId = nflSport.data.id as number;

  // Step 2: Find or create a league for seasons
  const leagueResult = await safeDbOperation(
    async () => {
      // Try to find an NFL-specific league first
      const { data: nflLeague, error: nflLeagueError } = await supabaseAdmin
        .from('leagues')
        .select('id')
        .eq('sport_id', sportId)
        .limit(1)
        .single();

      if (!nflLeagueError && nflLeague) {
        return nflLeague;
      }

      // If no NFL league exists, use any league as placeholder
      const { data: anyLeague, error: anyLeagueError } = await supabaseAdmin
        .from('leagues')
        .select('id')
        .limit(1)
        .single();

      if (anyLeagueError || !anyLeague) {
        throw new ContextualError(
          'No leagues exist in the system',
          {
            operation: 'find_any_league',
            additionalInfo: {
              sportId,
              errors: { nflLeagueError, anyLeagueError }
            }
          }
        );
      }

      return anyLeague;
    },
    { operation: 'ensure_league_exists', additionalInfo: { sportId } }
  );

  if (!leagueResult.success || !leagueResult.data) {
    throw new ContextualError(
      'Failed to find or create league for seasons',
      {
        operation: 'ensure_league_complete',
        additionalInfo: {
          sportId,
          error: leagueResult.error
        }
      }
    );
  }

  const league = validateDbResult(
    leagueResult.data,
    ['id'],
    { operation: 'validate_league' }
  );

  if (!league.success || !league.data) {
    throw new ContextualError(
      'League data is malformed',
      {
        operation: 'validate_league',
        data: leagueResult.data,
        additionalInfo: { error: league.error }
      }
    );
  }

  const leagueId = league.data.id as number;

  // Step 3: Ensure we have a current season
  const currentYear = new Date().getFullYear();
  const seasonName = `${currentYear} NFL Season`;

  const seasonResult = await safeDbOperation(
    async () => {
      const { data: existingSeason, error: seasonError } = await supabaseAdmin
        .from('seasons')
        .select('id')
        .eq('name', seasonName)
        .single();

      if (!seasonError && existingSeason) {
        return existingSeason;
      }

      // Create new season
      const { data: newSeason, error: createSeasonError } = await supabaseAdmin
        .from('seasons')
        .insert({
          name: seasonName,
          league_id: leagueId,
          start_date: `${currentYear}-09-01`,
          end_date: `${currentYear + 1}-02-28`
        })
        .select('id')
        .single();

      if (createSeasonError || !newSeason) {
        throw new ContextualError(
          'Failed to create season',
          {
            operation: 'create_season',
            additionalInfo: {
              seasonName,
              leagueId,
              createSeasonError
            }
          },
          createSeasonError
        );
      }

      return newSeason;
    },
    {
      operation: 'ensure_season_exists',
      additionalInfo: {
        seasonName,
        leagueId,
        currentYear
      }
    },
    // Fallback: Try to find any season to use temporarily
    async () => {
      console.warn('Attempting fallback: using any available season');
      const { data: anySeason, error } = await supabaseAdmin
        .from('seasons')
        .select('id')
        .eq('league_id', leagueId)
        .limit(1)
        .single();

      if (error || !anySeason) {
        throw new ContextualError(
          'No seasons exist for this league',
          { operation: 'fallback_any_season', additionalInfo: { leagueId } }
        );
      }

      return anySeason;
    }
  );

  if (!seasonResult.success || !seasonResult.data) {
    throw new ContextualError(
      'Failed to ensure season exists',
      {
        operation: 'ensure_season_complete',
        additionalInfo: {
          seasonName,
          leagueId,
          error: seasonResult.error
        }
      }
    );
  }

  const season = validateDbResult(
    seasonResult.data,
    ['id'],
    { operation: 'validate_season' }
  );

  if (!season.success || !season.data) {
    throw new ContextualError(
      'Season data is malformed',
      {
        operation: 'validate_season',
        data: seasonResult.data,
        additionalInfo: { error: season.error }
      }
    );
  }

  const seasonId = season.data.id as number;

  // Final validation
  if (typeof sportId !== 'number' || typeof seasonId !== 'number') {
    throw new ContextualError(
      'Invalid ID types returned from database',
      {
        operation: 'final_validation',
        additionalInfo: {
          sportId: typeof sportId,
          seasonId: typeof seasonId,
          data: { sportId, seasonId }
        }
      }
    );
  }

  return { sportId, seasonId };
}

/**
 * Ensure all teams from ESPN data exist in database
 */
async function ensureAllTeamsFromESPN(games: EnhancedESPNGame[], sportId: number): Promise<void> {
  const uniqueTeams = new Map<string, { name: string; abbreviation: string; espnId: string }>();

  // Collect all unique teams from ESPN games
  for (const game of games) {
    // Add home team
    if (!uniqueTeams.has(game.homeTeam.abbreviation)) {
      const fullName = ESPN_TO_FULL_NAME[game.homeTeam.abbreviation] ||
                      `Team ${game.homeTeam.abbreviation}`;
      uniqueTeams.set(game.homeTeam.abbreviation, {
        name: fullName,
        abbreviation: game.homeTeam.abbreviation,
        espnId: game.homeTeamId,
      });
    }

    // Add away team
    if (!uniqueTeams.has(game.awayTeam.abbreviation)) {
      const fullName = ESPN_TO_FULL_NAME[game.awayTeam.abbreviation] ||
                      `Team ${game.awayTeam.abbreviation}`;
      uniqueTeams.set(game.awayTeam.abbreviation, {
        name: fullName,
        abbreviation: game.awayTeam.abbreviation,
        espnId: game.awayTeamId,
      });
    }
  }


  // Create or update teams
  for (const [, teamData] of uniqueTeams) {
    await ensureTeam(teamData.name, teamData.abbreviation, sportId);
  }
}

/**
 * Ensure a team exists in the database with robust error handling
 */
async function ensureTeam(teamName: string, abbreviation: string, sportId: number): Promise<number> {
  // Input validation
  if (!teamName?.trim() || !abbreviation?.trim() || typeof sportId !== 'number') {
    throw new ContextualError(
      'Invalid team parameters',
      {
        operation: 'ensure_team_validation',
        additionalInfo: {
          teamName,
          abbreviation,
          sportId: typeof sportId
        }
      }
    );
  }

  const teamResult = await safeDbOperation(
    async () => {
      // Try to find existing team first
      const { data: existingTeam, error: findError } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('abbreviation', abbreviation.trim())
        .eq('sport_id', sportId)
        .single();

      if (!findError && existingTeam) {
        return existingTeam;
      }

      // Create new team if not found
      const { data: newTeam, error: createError } = await supabaseAdmin
        .from('teams')
        .insert({
          name: teamName.trim(),
          abbreviation: abbreviation.trim(),
          sport_id: sportId
        })
        .select('id')
        .single();

      if (createError || !newTeam) {
        throw new ContextualError(
          `Failed to create team ${teamName}`,
          {
            operation: 'create_team',
            additionalInfo: {
              teamName,
              abbreviation,
              sportId,
              createError
            }
          },
          createError
        );
      }

      return newTeam;
    },
    {
      operation: 'ensure_team',
      additionalInfo: {
        teamName,
        abbreviation,
        sportId
      }
    },
    // Fallback: Try to find any team with the same abbreviation (different sport)
    async () => {
      console.warn(`Fallback: searching for team with abbreviation ${abbreviation} in any sport`);
      const { data: anyTeam, error } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('abbreviation', abbreviation.trim())
        .limit(1)
        .single();

      if (error || !anyTeam) {
        throw new ContextualError(
          `No fallback team found for abbreviation ${abbreviation}`,
          { operation: 'fallback_team_search', additionalInfo: { abbreviation } }
        );
      }

      return anyTeam;
    }
  );

  if (!teamResult.success || !teamResult.data) {
    throw new ContextualError(
      `Failed to ensure team exists: ${teamName}`,
      {
        operation: 'ensure_team_complete',
        additionalInfo: {
          teamName,
          abbreviation,
          sportId,
          error: teamResult.error,
          fallbackUsed: teamResult.fallbackUsed
        }
      }
    );
  }

  const team = validateDbResult(
    teamResult.data,
    ['id'],
    { operation: 'validate_team_data', additionalInfo: { teamName, abbreviation } }
  );

  if (!team.success || !team.data) {
    throw new ContextualError(
      'Team data is malformed',
      {
        operation: 'validate_team_data',
        additionalInfo: {
          teamName,
          abbreviation,
          data: teamResult.data,
          error: team.error
        }
      }
    );
  }

  const teamId = team.data.id;

  if (typeof teamId !== 'number') {
    throw new ContextualError(
      'Team ID is not a valid number',
      {
        operation: 'validate_team_id_type',
        additionalInfo: {
          teamName,
          abbreviation,
          teamId: typeof teamId,
          data: teamId
        }
      }
    );
  }

  return teamId;
}

/**
 * Ingest all games from ESPN into database
 */
async function ingestGamesFromESPN(
  games: EnhancedESPNGame[],
  seasonId: number
): Promise<{
  newGames: number;
  updatedGames: number;
  errors: number;
}> {
  let newGames = 0;
  let updatedGames = 0;
  let errors = 0;


  for (const espnGame of games) {
    try {
      // Find team IDs by abbreviation
      const { data: homeTeam } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('abbreviation', espnGame.homeTeam.abbreviation)
        .single();

      const { data: awayTeam } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('abbreviation', espnGame.awayTeam.abbreviation)
        .single();

      if (!homeTeam || !awayTeam) {
        console.error(`Team not found for game ${espnGame.espnGameId}`);
        errors++;
        continue;
      }

      // Check if game already exists by ESPN ID
      const { data: existingGame, error: gameCheckError } = await supabaseAdmin
        .from('games')
        .select('id, home_score, away_score, status')
        .eq('espn_game_id', espnGame.espnGameId)
        .single();

      const gameData = {
        season_id: seasonId,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        start_time: espnGame.startTime,
        espn_game_id: espnGame.espnGameId,
        status: espnGame.status.completed ? 'completed' :
               espnGame.status.state === 'in' ? 'in_progress' : 'scheduled',
        home_score: espnGame.homeTeam.score,
        away_score: espnGame.awayTeam.score,
      };

      if (gameCheckError || !existingGame) {
        // Create new game
        const { error: createGameError } = await supabaseAdmin
          .from('games')
          .insert(gameData);

        if (createGameError) {
          console.error(`Failed to create game ${espnGame.espnGameId}:`, createGameError.message);
          errors++;
        } else {
          newGames++;
        }
      } else {
        // Update existing game if status or scores changed
        const needsUpdate =
          existingGame.status !== gameData.status ||
          existingGame.home_score !== gameData.home_score ||
          existingGame.away_score !== gameData.away_score;

        if (needsUpdate) {
          const { error: updateGameError } = await supabaseAdmin
            .from('games')
            .update({
              status: gameData.status,
              home_score: gameData.home_score,
              away_score: gameData.away_score,
            })
            .eq('id', existingGame.id);

          if (updateGameError) {
            console.error(`Failed to update game ${espnGame.espnGameId}:`, updateGameError.message);
            errors++;
          } else {
            updatedGames++;
          }
        }
      }

    } catch (gameError) {
      console.error(`Error processing game ${espnGame.espnGameId}:`, gameError);
      errors++;
    }
  }


  return { newGames, updatedGames, errors };
}
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentNFLWeek } from '@/lib/nfl-week';
import { rateLimitScoringAuto } from '@/lib/rate-limit';
import {
  fetchESPNScoreboard,
  processESPNGames,
  getCompletedGames,
  type ProcessedGameData,
} from '@/lib/espn-monitor';
import {
  ScoringCalculator,
  getLeagueScoringRules,
  recalculateUserSeasonStats,
  type Pick as ScoringPick
} from '@/lib/scoring';

interface DatabaseGame {
  id: number;
  espn_game_id: string;
  status: string;
  home_team: {
    abbreviation: string;
  };
  away_team: {
    abbreviation: string;
  };
}

interface DatabasePick {
  id: number;
  user_id: string;
  game_id: number;
  bet_type: string;
  selection: string;
  result: string | null;
  points_awarded: number;
  week: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const currentWeek = getCurrentNFLWeek();

  console.log(`Starting automated scoring for week ${currentWeek}`);

  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimitScoringAuto(ip);

    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: 'Too many requests',
        message: 'Rate limit exceeded for scoring endpoint',
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

    // CRON secret validation
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '') ||
                          request.headers.get('x-cron-secret');

    if (!cronSecret) {
      console.error('CRON_SECRET environment variable not configured');
      return NextResponse.json({
        error: 'Server configuration error'
      }, { status: 500 });
    }

    if (!providedSecret || providedSecret !== cronSecret) {
      console.warn('Unauthorized scoring auto request', { ip, providedSecret: !!providedSecret });
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Valid CRON secret required'
      }, { status: 401 });
    }
    // 1. Fetch ESPN scoreboard data
    let espnData;
    let espnError: string | null = null;
    let responseTimeMs = 0;

    try {
      espnData = await fetchESPNScoreboard(currentWeek);
      responseTimeMs = Date.now() - startTime;
    } catch (error) {
      responseTimeMs = Date.now() - startTime;
      espnError = error instanceof Error ? error.message : 'ESPN API fetch failed';

      // Log failed API call
      await supabaseAdmin.from('espn_api_calls').insert({
        endpoint: `/apis/site/v2/sports/football/nfl/scoreboard?week=${currentWeek}`,
        week: currentWeek,
        status_code: 0,
        games_found: 0,
        completed_games: 0,
        newly_completed: 0,
        response_time_ms: responseTimeMs,
        error_message: espnError,
      });

      return NextResponse.json({
        error: 'Failed to fetch ESPN data',
        details: espnError,
      }, { status: 500 });
    }

    // 2. Process ESPN games
    const processedGames = processESPNGames(espnData);
    const completedGames = getCompletedGames(processedGames);

    console.log(`ESPN data processed: ${processedGames.length} total games, ${completedGames.length} completed`);

    // 3. Find newly completed games (not already scored)
    const newlyCompletedGames: ProcessedGameData[] = [];

    for (const espnGame of completedGames) {
      // Check if we already processed this game
      const { data: existingEvent } = await supabaseAdmin
        .from('scoring_events')
        .select('id')
        .eq('espn_game_id', espnGame.espnGameId)
        .single();

      if (!existingEvent) {
        newlyCompletedGames.push(espnGame);
      }
    }

    console.log(`Found ${newlyCompletedGames.length} newly completed games to process`);

    // 4. Process each newly completed game
    let totalPicksProcessed = 0;
    let totalPointsAwarded = 0;
    const processedGameIds: string[] = [];

    for (const espnGame of newlyCompletedGames) {
      try {
        const result = await processCompletedGame(espnGame);
        totalPicksProcessed += result.picksProcessed;
        totalPointsAwarded += result.pointsAwarded;
        processedGameIds.push(espnGame.espnGameId);
      } catch (error) {
        console.error(`Failed to process game ${espnGame.espnGameId}:`, error);

        // Log failed scoring attempt
        await supabaseAdmin.from('scoring_events').insert({
          espn_game_id: espnGame.espnGameId,
          game_id: null,
          status_before: 'unknown',
          status_after: 'completed',
          home_score: espnGame.homeTeam.score,
          away_score: espnGame.awayTeam.score,
          picks_processed: 0,
          points_awarded: 0,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 5. Log successful ESPN API call
    await supabaseAdmin.from('espn_api_calls').insert({
      endpoint: `/apis/site/v2/sports/football/nfl/scoreboard?week=${currentWeek}`,
      week: currentWeek,
      status_code: 200,
      games_found: processedGames.length,
      completed_games: completedGames.length,
      newly_completed: newlyCompletedGames.length,
      response_time_ms: responseTimeMs,
      error_message: null,
    });

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      week: currentWeek,
      summary: {
        totalGames: processedGames.length,
        completedGames: completedGames.length,
        newlyCompleted: newlyCompletedGames.length,
        picksProcessed: totalPicksProcessed,
        pointsAwarded: totalPointsAwarded,
        processedGameIds,
      },
      timing: {
        espnResponseTime: responseTimeMs,
        totalProcessingTime: totalTime,
      },
    });

  } catch (error) {
    console.error('Automated scoring failed:', error);

    return NextResponse.json({
      error: 'Automated scoring failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Process a single completed game and score all picks
 */
async function processCompletedGame(espnGame: ProcessedGameData): Promise<{
  picksProcessed: number;
  pointsAwarded: number;
}> {
  console.log(`Processing completed game: ${espnGame.homeTeam.abbreviation} vs ${espnGame.awayTeam.abbreviation}`);

  // 1. Find the matching game in our database
  const { data: dbGame, error: gameError } = await supabaseAdmin
    .from('games')
    .select(`
      id,
      espn_game_id,
      status,
      home_team:teams!games_home_team_id_fkey(abbreviation),
      away_team:teams!games_away_team_id_fkey(abbreviation)
    `)
    .eq('espn_game_id', espnGame.espnGameId)
    .single();

  if (gameError || !dbGame) {
    // Try to match by team abbreviations and date if no ESPN ID mapping
    const gameDate = new Date(espnGame.startTime);
    const startOfDay = new Date(gameDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(gameDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: dbGameByTeams, error: teamMatchError } = await supabaseAdmin
      .from('games')
      .select(`
        id,
        espn_game_id,
        status,
        start_time,
        home_team:teams!games_home_team_id_fkey(abbreviation),
        away_team:teams!games_away_team_id_fkey(abbreviation)
      `)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .single();

    if (teamMatchError || !dbGameByTeams) {
      throw new Error(`Could not find database game for ESPN game ${espnGame.espnGameId}`);
    }

    // Update the database game with ESPN ID for future lookups
    await supabaseAdmin
      .from('games')
      .update({ espn_game_id: espnGame.espnGameId })
      .eq('id', dbGameByTeams.id);

    // Use the matched game
    if (dbGame && dbGameByTeams) {
      Object.assign(dbGame, dbGameByTeams);
    }
  }

  const typedDbGame = dbGame as unknown as DatabaseGame;

  // 2. Update game status and scores in database
  await supabaseAdmin
    .from('games')
    .update({
      status: 'completed',
      home_score: espnGame.homeTeam.score,
      away_score: espnGame.awayTeam.score,
    })
    .eq('id', typedDbGame.id);

  // 3. Get all picks for this game
  const { data: picks, error: picksError } = await supabaseAdmin
    .from('picks')
    .select('*')
    .eq('game_id', typedDbGame.id)
    .is('result', null); // Only unprocessed picks

  if (picksError) {
    throw new Error(`Failed to fetch picks for game ${typedDbGame.id}: ${picksError.message}`);
  }

  if (!picks || picks.length === 0) {
    console.log(`No picks found for game ${typedDbGame.id}`);

    // Still create scoring event to mark as processed
    await supabaseAdmin.from('scoring_events').insert({
      game_id: typedDbGame.id,
      espn_game_id: espnGame.espnGameId,
      status_before: typedDbGame.status,
      status_after: 'completed',
      home_score: espnGame.homeTeam.score,
      away_score: espnGame.awayTeam.score,
      picks_processed: 0,
      points_awarded: 0,
    });

    return { picksProcessed: 0, pointsAwarded: 0 };
  }

  // 4. Get scoring rules for the season's league
  const { data: seasonData } = await supabaseAdmin
    .from('seasons')
    .select('league_id')
    .eq('id', (await supabaseAdmin
      .from('games')
      .select('season_id')
      .eq('id', typedDbGame.id)
      .single()
    ).data?.season_id)
    .single();

  const scoringRules = await getLeagueScoringRules(seasonData?.league_id || 1);
  const calculator = new ScoringCalculator(scoringRules);

  // 5. Score each pick using enhanced calculation
  let pointsAwarded = 0;
  const pickUpdates: Array<{ id: number; result: string; points_awarded: number }> = [];
  const affectedUsers = new Set<string>();

  for (const pick of picks as DatabasePick[]) {
    const gameResult = {
      home_score: espnGame.homeTeam.score || 0,
      away_score: espnGame.awayTeam.score || 0,
      status: 'completed'
    };

    const pickResult = calculator.calculatePick(pick, gameResult);

    pickUpdates.push({
      id: pick.id,
      result: pickResult.result,
      points_awarded: pickResult.points,
    });

    pointsAwarded += pickResult.points;
    affectedUsers.add(pick.user_id);

    // Log detailed scoring for debugging
    console.log(`Pick ${pick.id}: ${pick.bet_type} ${pick.selection} -> ${pickResult.result} (${pickResult.points} pts) - ${pickResult.explanation}`);
  }

  // 6. Update all picks in batch
  for (const update of pickUpdates) {
    await supabaseAdmin
      .from('picks')
      .update({
        result: update.result,
        points_awarded: update.points_awarded,
      })
      .eq('id', update.id);
  }

  // 7. Recalculate user season stats for affected users
  const { data: gameSeasonData } = await supabaseAdmin
    .from('games')
    .select('season_id')
    .eq('id', typedDbGame.id)
    .single();

  if (gameSeasonData?.season_id) {
    for (const userId of affectedUsers) {
      try {
        await recalculateUserSeasonStats(userId, gameSeasonData.season_id);
      } catch (error) {
        console.error(`Failed to recalculate stats for user ${userId}:`, error);
      }
    }
  }

  // 8. Create scoring event record
  await supabaseAdmin.from('scoring_events').insert({
    game_id: typedDbGame.id,
    espn_game_id: espnGame.espnGameId,
    status_before: typedDbGame.status,
    status_after: 'completed',
    home_score: espnGame.homeTeam.score,
    away_score: espnGame.awayTeam.score,
    picks_processed: picks.length,
    points_awarded: pointsAwarded,
  });

  console.log(`Scored ${picks.length} picks for game ${typedDbGame.id}, awarded ${pointsAwarded} points`);

  return {
    picksProcessed: picks.length,
    pointsAwarded,
  };
}


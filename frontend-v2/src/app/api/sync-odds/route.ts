import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rateLimitOddsSync } from '@/lib/rate-limit';
import {
  matchOddsGamesToESPNGames,
  storeGameMatchingResults,
  OddsSourceGame,
} from '@/lib/game-matching';

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

async function fetchNFLGames(): Promise<OddsApiGame[]> {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    throw new Error('ODDS_API_KEY environment variable is required');
  }

  // NOTE: The Odds API requires API key in query string (not headers)
  // This means the key will be logged in proxies/access logs
  // Mitigation: Use server-side only, rotate keys regularly, monitor usage
  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?` +
    `apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`;

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      // Don't log the full URL (contains API key)
      throw new Error(`Odds API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Validate API response structure
    if (!Array.isArray(data)) {
      throw new Error('Invalid API response: expected array of games');
    }

    // Validate critical fields exist on each game
    for (const game of data) {
      if (!game.id || !game.home_team || !game.away_team || !game.commence_time) {
        throw new Error(`Invalid game data: missing required fields (id: ${game.id})`);
      }

      if (!Array.isArray(game.bookmakers)) {
        throw new Error(`Invalid game data: bookmakers must be an array (game: ${game.id})`);
      }
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new Error('Odds API request timeout after 10 seconds');
    }
    // Re-throw without exposing URL (which contains API key)
    throw error;
  }
}

// NOTE: The ensureTeamsAndSeason and ensureTeam functions have been removed
// as they are no longer needed in the ESPN-primary architecture.
// Games and teams are now created via the ESPN season ingestion process,
// and odds are attached to existing games via the matching algorithm.

export async function POST(request: NextRequest) {
  // Generate request ID for observability and debugging
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Rate limiting - use verified IP to prevent spoofing
    // x-real-ip is Vercel's verified IP header, fallback to first x-forwarded-for
    const ip = request.headers.get('x-real-ip') ||
               request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               'unknown';

    // Structured logging: request start
    console.log({
      requestId,
      event: 'odds_sync_start',
      ip,
      timestamp: new Date().toISOString()
    });

    const rateLimitResult = await rateLimitOddsSync(ip);

    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: 'Too many requests',
        message: 'Rate limit exceeded for odds sync endpoint',
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

    // CRON secret validation (REQUIRED in production)
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({
        error: 'Configuration Error',
        message: 'CRON_SECRET must be configured in production'
      }, { status: 500 });
    }

    const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '') ||
                          request.headers.get('x-cron-secret');

    if (!providedSecret || providedSecret !== cronSecret) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Valid CRON secret required'
      }, { status: 401 });
    }

    const supabase = supabaseAdmin;

    // Structured logging: fetching odds data
    // NOTE: Do not log URLs or request details (they contain API keys)
    console.log({
      requestId,
      event: 'fetching_odds_api',
      timestamp: new Date().toISOString()
    });

    // Fetch games from The Odds API
    const gamesData = await fetchNFLGames();

    // Structured logging: odds data received
    console.log({
      requestId,
      event: 'odds_api_fetch_complete',
      gameCount: gamesData.length,
      timestamp: new Date().toISOString()
    });

    if (gamesData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Odds sync endpoint is working',
        timestamp: new Date().toISOString(),
        syncedGames: 0,
        syncedOdds: 0,
        note: 'No games available from Odds API'
      });
    }

    // Convert Odds API games to our matching format
    const oddsSourceGames: OddsSourceGame[] = gamesData.map(game => ({
      id: game.id,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      commenceTime: game.commence_time,
      sport: game.sport_key,
      source: 'odds_api',
    }));

    // NEW ARCHITECTURE: Match odds games to existing ESPN games
    const matchingResult = await matchOddsGamesToESPNGames(oddsSourceGames, {
      confidenceThreshold: 70, // Lower threshold for odds sync
      timeToleranceHours: 12, // More tolerance for odds timing
      enableFuzzyMatching: true,
    });

    // Store matching results for monitoring
    if (matchingResult.matches.length > 0) {
      await storeGameMatchingResults(matchingResult.matches, 'odds_api');
    }

    let syncedOdds = 0;
    let attachmentErrors = 0;

    // Circuit breaker: stop processing if too many consecutive errors
    const MAX_CONSECUTIVE_ERRORS = 10;
    let consecutiveErrors = 0;

    // Process odds for matched games only
    for (const match of matchingResult.matches) {
      try {
        const gameId = match.databaseGame.id;
        const oddsApiGame = gamesData.find(g => g.id === match.oddsGame.id);

        if (!oddsApiGame) {
          attachmentErrors++;
          consecutiveErrors++;

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error({
              requestId,
              event: 'circuit_breaker_triggered',
              reason: 'odds_game_not_found',
              consecutiveErrors,
              timestamp: new Date().toISOString()
            });
            break;
          }
          continue;
        }

        // Process odds from bookmakers
        for (const bookmaker of oddsApiGame.bookmakers) {
          // Clear existing odds for this game and bookmaker
          await supabase
            .from('odds')
            .delete()
            .eq('game_id', gameId)
            .eq('sportsbook', bookmaker.key);

          // Process each market
          let moneylineHome = null, moneylineAway = null;
          let spreadHome = null, spreadAway = null;
          let totalOver = null, totalUnder = null;

          for (const market of bookmaker.markets) {
            if (market.key === 'h2h') {
              // Moneyline
              const homeOutcome = market.outcomes.find(o => o.name === oddsApiGame.home_team);
              const awayOutcome = market.outcomes.find(o => o.name === oddsApiGame.away_team);
              moneylineHome = homeOutcome?.price || null;
              moneylineAway = awayOutcome?.price || null;
            } else if (market.key === 'spreads') {
              // Point spreads
              const homeOutcome = market.outcomes.find(o => o.name === oddsApiGame.home_team);
              const awayOutcome = market.outcomes.find(o => o.name === oddsApiGame.away_team);
              spreadHome = homeOutcome?.point || null;
              spreadAway = awayOutcome?.point || null;
            } else if (market.key === 'totals') {
              // Over/Under
              const overOutcome = market.outcomes.find(o => o.name === 'Over');
              const underOutcome = market.outcomes.find(o => o.name === 'Under');
              totalOver = overOutcome?.point || null;
              totalUnder = underOutcome?.point || null;
            }
          }

          // Insert new odds
          const { error: oddsError } = await supabase
            .from('odds')
            .insert({
              game_id: gameId,
              sportsbook: bookmaker.key,
              last_update: bookmaker.last_update,
              moneyline_home: moneylineHome,
              moneyline_away: moneylineAway,
              spread_home: spreadHome,
              spread_away: spreadAway,
              total_over: totalOver,
              total_under: totalUnder
            });

          if (oddsError) {
            attachmentErrors++;
            consecutiveErrors++;

            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.error({
                requestId,
                event: 'circuit_breaker_triggered',
                reason: 'database_errors',
                consecutiveErrors,
                timestamp: new Date().toISOString()
              });
              break;
            }
          } else {
            syncedOdds++;
            consecutiveErrors = 0; // Reset on success
          }
        }
      } catch (error) {
        attachmentErrors++;
        consecutiveErrors++;
        console.error({
          requestId,
          event: 'match_processing_error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error({
            requestId,
            event: 'circuit_breaker_triggered',
            reason: 'match_processing_errors',
            consecutiveErrors,
            timestamp: new Date().toISOString()
          });
          break;
        }
        continue;
      }
    }

    const durationMs = Date.now() - startTime;

    // Structured logging: request complete
    console.log({
      requestId,
      event: 'odds_sync_complete',
      durationMs,
      matchedGames: matchingResult.matchedGames,
      syncedOdds,
      errors: attachmentErrors,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'NFL odds sync completed with ESPN game matching',
      requestId, // Include request ID for client-side correlation
      timestamp: new Date().toISOString(),
      architecture: 'espn_primary', // Indicate new architecture
      gameMatching: {
        totalOddsGames: matchingResult.totalOddsGames,
        matchedGames: matchingResult.matchedGames,
        unmatchedGames: matchingResult.unmatchedGames,
        highConfidenceMatches: matchingResult.highConfidenceMatches,
        averageConfidence: matchingResult.matches.length > 0
          ? Math.round(matchingResult.matches.reduce((sum, m) => sum + m.confidence, 0) / matchingResult.matches.length)
          : 0,
      },
      oddsAttachment: {
        syncedOdds,
        attachmentErrors,
        successRate: matchingResult.matchedGames > 0
          ? Math.round((syncedOdds / (syncedOdds + attachmentErrors)) * 100)
          : 0,
      },
      unmatchedGames: matchingResult.unmatchedOddsGames.map(game => ({
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        commenceTime: game.commenceTime,
      })),
      totalGamesFromAPI: gamesData.length,
      performance: {
        durationMs
      }
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Structured logging: error occurred
    console.error({
      requestId,
      event: 'odds_sync_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      durationMs,
      timestamp: new Date().toISOString()
    });

    // Return sanitized error to client (hide details in production)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      requestId, // Include request ID for support/debugging
      // Only include error details in development
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }, { status: 500 });
  }
}
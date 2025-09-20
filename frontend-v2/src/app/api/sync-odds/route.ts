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

  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?` +
    `apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  return data;
}

// NOTE: The ensureTeamsAndSeason and ensureTeam functions have been removed
// as they are no longer needed in the ESPN-primary architecture.
// Games and teams are now created via the ESPN season ingestion process,
// and odds are attached to existing games via the matching algorithm.

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
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

    const supabase = supabaseAdmin;

    // Fetch games from The Odds API
    const gamesData = await fetchNFLGames();

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

    // Process odds for matched games only
    for (const match of matchingResult.matches) {
      try {
        const gameId = match.databaseGame.id;
        const oddsApiGame = gamesData.find(g => g.id === match.oddsGame.id);

        if (!oddsApiGame) {
          attachmentErrors++;
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
          } else {
            syncedOdds++;
          }
        }
      } catch {
        attachmentErrors++;
        continue;
      }
    }

    // Summary logging kept minimal for production monitoring

    return NextResponse.json({
      success: true,
      message: 'NFL odds sync completed with ESPN game matching',
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
      totalGamesFromAPI: gamesData.length
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
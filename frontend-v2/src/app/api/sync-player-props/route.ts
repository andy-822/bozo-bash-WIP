import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rateLimitOddsSync } from '@/lib/rate-limit';

interface OddsApiPlayerProp {
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
      description?: string;
      outcomes: Array<{
        name: string;
        description?: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

interface PlayerPropData {
  gameId: number;
  athleteId: string;
  athleteName: string;
  teamId: number;
  sportsbook: string;
  marketKey: string;
  description: string;
  lastUpdate: string;
  overPrice?: number;
  underPrice?: number;
  point?: number;
}

const PLAYER_PROP_MARKETS = [
  'player_pass_yds',
  'player_rush_yds',
  'player_reception_yds',
  'player_anytime_td',
  'player_pass_tds',
  'player_rush_tds'
];

async function fetchPlayerPropsForGame(gameId: string): Promise<OddsApiPlayerProp | null> {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    throw new Error('ODDS_API_KEY environment variable is required');
  }

  const markets = PLAYER_PROP_MARKETS.join(',');
  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${gameId}/odds/?` +
    `apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american&dateFormat=iso`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const errorText = await response.text();
    throw new Error(`Odds API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

async function matchPlayerToTeamStats(
  playerName: string,
  teamId: number
): Promise<{ athleteId: string; athleteName: string } | null> {
  const supabase = supabaseAdmin;

  const { data: players, error } = await supabase
    .from('team_stats')
    .select('athlete_id, athlete_name')
    .eq('team_id', teamId)
    .not('athlete_id', 'is', null)
    .not('athlete_name', 'is', null);

  if (error || !players) {
    console.error('Error fetching team stats:', error);
    return null;
  }

  const normalizedSearchName = playerName.toLowerCase().trim();

  for (const player of players) {
    const normalizedPlayerName = player.athlete_name.toLowerCase().trim();

    if (normalizedPlayerName === normalizedSearchName) {
      return {
        athleteId: player.athlete_id,
        athleteName: player.athlete_name
      };
    }
  }

  for (const player of players) {
    const normalizedPlayerName = player.athlete_name.toLowerCase().trim();

    if (normalizedPlayerName.includes(normalizedSearchName) ||
        normalizedSearchName.includes(normalizedPlayerName)) {
      return {
        athleteId: player.athlete_id,
        athleteName: player.athlete_name
      };
    }
  }

  const nameParts = normalizedSearchName.split(' ');
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    for (const player of players) {
      const normalizedPlayerName = player.athlete_name.toLowerCase().trim();
      if (normalizedPlayerName.includes(firstName) && normalizedPlayerName.includes(lastName)) {
        return {
          athleteId: player.athlete_id,
          athleteName: player.athlete_name
        };
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimitOddsSync(ip);

    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: 'Too many requests',
        message: 'Rate limit exceeded for player props sync endpoint',
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

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        id,
        home_team_id,
        away_team_id,
        start_time,
        teams_home:teams!games_home_team_id_fkey(id, name),
        teams_away:teams!games_away_team_id_fkey(id, name)
      `)
      .gte('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

    if (gamesError || !games) {
      throw new Error(`Failed to fetch games: ${gamesError?.message}`);
    }

    const { data: oddsSourceMappings, error: mappingError } = await supabase
      .from('odds_source_mapping')
      .select('game_id, source_game_id')
      .eq('source_type', 'odds_api');

    if (mappingError) {
      throw new Error(`Failed to fetch odds mappings: ${mappingError?.message}`);
    }

    const gameOddsIdMap = new Map<number, string>();
    oddsSourceMappings?.forEach(mapping => {
      if (mapping.source_game_id) {
        gameOddsIdMap.set(mapping.game_id, mapping.source_game_id);
      }
    });

    let totalPropsSynced = 0;
    let totalPlayersMatched = 0;
    let totalErrors = 0;
    const processedGames = new Set<number>();

    for (const game of games) {
      try {
        const oddsGameId = gameOddsIdMap.get(game.id);
        if (!oddsGameId) {
          continue;
        }

        if (processedGames.has(game.id)) {
          continue;
        }

        const propData = await fetchPlayerPropsForGame(oddsGameId);
        if (!propData) {
          continue;
        }

        const playerPropsToInsert: PlayerPropData[] = [];

        for (const bookmaker of propData.bookmakers) {
          for (const market of bookmaker.markets) {
            if (!PLAYER_PROP_MARKETS.includes(market.key)) {
              continue;
            }

            for (const outcome of market.outcomes) {
              const playerName = outcome.name;
              if (!playerName || playerName === 'Over' || playerName === 'Under') {
                continue;
              }

              const homeTeamMatch = await matchPlayerToTeamStats(playerName, game.home_team_id);
              let matchedPlayer = homeTeamMatch;
              let teamId = game.home_team_id;

              if (!homeTeamMatch) {
                const awayTeamMatch = await matchPlayerToTeamStats(playerName, game.away_team_id);
                if (awayTeamMatch) {
                  matchedPlayer = awayTeamMatch;
                  teamId = game.away_team_id;
                }
              }

              if (!matchedPlayer) {
                console.log(`Could not match player: ${playerName} for game ${game.id}`);
                continue;
              }

              const existingPropIndex = playerPropsToInsert.findIndex(
                p => p.gameId === game.id &&
                     p.athleteId === matchedPlayer.athleteId &&
                     p.sportsbook === bookmaker.key &&
                     p.marketKey === market.key
              );

              if (existingPropIndex >= 0) {
                if (outcome.point !== undefined) {
                  if (outcome.description?.toLowerCase().includes('over') || (!outcome.description && outcome.price > 0)) {
                    playerPropsToInsert[existingPropIndex].overPrice = outcome.price;
                  } else {
                    playerPropsToInsert[existingPropIndex].underPrice = outcome.price;
                  }
                  playerPropsToInsert[existingPropIndex].point = outcome.point;
                }
              } else {
                const propData: PlayerPropData = {
                  gameId: game.id,
                  athleteId: matchedPlayer.athleteId,
                  athleteName: matchedPlayer.athleteName,
                  teamId: teamId,
                  sportsbook: bookmaker.key,
                  marketKey: market.key,
                  description: market.description || `${matchedPlayer.athleteName} ${market.key}`,
                  lastUpdate: bookmaker.last_update,
                  point: outcome.point
                };

                if (outcome.point !== undefined) {
                  if (outcome.description?.toLowerCase().includes('over') || (!outcome.description && outcome.price > 0)) {
                    propData.overPrice = outcome.price;
                  } else {
                    propData.underPrice = outcome.price;
                  }
                }

                playerPropsToInsert.push(propData);
                totalPlayersMatched++;
              }
            }
          }
        }

        if (playerPropsToInsert.length > 0) {
          await supabase
            .from('player_props')
            .delete()
            .eq('game_id', game.id);

          const { error: insertError } = await supabase
            .from('player_props')
            .insert(playerPropsToInsert.map(prop => ({
              game_id: prop.gameId,
              athlete_id: prop.athleteId,
              athlete_name: prop.athleteName,
              team_id: prop.teamId,
              sportsbook: prop.sportsbook,
              market_key: prop.marketKey,
              description: prop.description,
              last_update: prop.lastUpdate,
              over_price: prop.overPrice,
              under_price: prop.underPrice,
              point: prop.point
            })));

          if (insertError) {
            console.error('Error inserting player props:', insertError);
            totalErrors++;
          } else {
            totalPropsSynced += playerPropsToInsert.length;
          }
        }

        processedGames.add(game.id);

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (gameError) {
        console.error(`Error processing game ${game.id}:`, gameError);
        totalErrors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Player props sync completed',
      timestamp: new Date().toISOString(),
      gamesSynced: processedGames.size,
      propsSynced: totalPropsSynced,
      playersMatched: totalPlayersMatched,
      errors: totalErrors,
      marketsSynced: PLAYER_PROP_MARKETS
    });

  } catch (error) {
    console.error('Player props sync error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
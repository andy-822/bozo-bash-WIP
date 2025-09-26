import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const PLAYER_PROP_MARKETS = [
  'player_pass_yds',
  'player_rush_yds',
  'player_reception_yds',
  'player_anytime_td',
  'player_pass_tds',
  'player_rush_tds'
];

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

async function fetchPlayerPropsForGame(gameId: string): Promise<OddsApiPlayerProp | null> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return null;

  const markets = PLAYER_PROP_MARKETS.join(',');
  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${gameId}/odds/?` +
    `apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american&dateFormat=iso`;

  const response = await fetch(url);
  if (!response.ok) return null;

  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin;

    // Get first game with odds mapping
    const { data: mappings } = await supabase
      .from('odds_source_mapping')
      .select('game_id, source_game_id, games(*)')
      .eq('source_type', 'odds_api')
      .limit(1)
      .single();

    if (!mappings?.source_game_id) {
      return NextResponse.json({
        error: 'No odds source mapping found',
        suggestion: 'Run ESPN season ingestion first'
      });
    }

    // Fetch props for this game
    const propData = await fetchPlayerPropsForGame(mappings.source_game_id);
    if (!propData) {
      return NextResponse.json({
        error: 'No props data from Odds API',
        gameId: mappings.source_game_id
      });
    }

    // Extract all player names from props
    const playerNamesFromOdds: string[] = [];
    for (const bookmaker of propData.bookmakers) {
      for (const market of bookmaker.markets) {
        if (!PLAYER_PROP_MARKETS.includes(market.key)) continue;

        for (const outcome of market.outcomes) {
          const playerName = outcome.name;
          if (!playerName ||
              playerName === 'Over' ||
              playerName === 'Under' ||
              playerName === 'Yes' ||
              playerName === 'No' ||
              playerName.length < 3) {
            continue;
          }

          if (!playerNamesFromOdds.includes(playerName)) {
            playerNamesFromOdds.push(playerName);
          }
        }
      }
    }

    // Get team stats for this game
    const game = mappings.games;
    const { data: homeTeamStats } = await supabase
      .from('team_stats')
      .select('athlete_id, athlete_name, athlete_position')
      .eq('team_id', game.home_team_id)
      .not('athlete_id', 'is', null);

    const { data: awayTeamStats } = await supabase
      .from('team_stats')
      .select('athlete_id, athlete_name, athlete_position')
      .eq('team_id', game.away_team_id)
      .not('athlete_id', 'is', null);

    return NextResponse.json({
      success: true,
      gameInfo: {
        gameId: game.id,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        oddsGameId: mappings.source_game_id
      },
      oddsApiPlayers: playerNamesFromOdds,
      teamStatsPlayers: {
        homeTeam: (homeTeamStats || []).map(p => ({
          name: p.athlete_name,
          position: p.athlete_position,
          id: p.athlete_id
        })),
        awayTeam: (awayTeamStats || []).map(p => ({
          name: p.athlete_name,
          position: p.athlete_position,
          id: p.athlete_id
        }))
      },
      potentialMatches: playerNamesFromOdds.map(oddsName => {
        const homeMatch = (homeTeamStats || []).find(p =>
          p.athlete_name?.toLowerCase().includes(oddsName.toLowerCase()) ||
          oddsName.toLowerCase().includes(p.athlete_name?.toLowerCase())
        );
        const awayMatch = (awayTeamStats || []).find(p =>
          p.athlete_name?.toLowerCase().includes(oddsName.toLowerCase()) ||
          oddsName.toLowerCase().includes(p.athlete_name?.toLowerCase())
        );

        return {
          oddsName,
          homeMatch: homeMatch ? { name: homeMatch.athlete_name, id: homeMatch.athlete_id } : null,
          awayMatch: awayMatch ? { name: awayMatch.athlete_name, id: awayMatch.athlete_id } : null
        };
      })
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
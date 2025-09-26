import { NextResponse } from 'next/server';
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

  // Exact match
  for (const player of players) {
    const normalizedPlayerName = player.athlete_name.toLowerCase().trim();
    if (normalizedPlayerName === normalizedSearchName) {
      return {
        athleteId: player.athlete_id,
        athleteName: player.athlete_name
      };
    }
  }

  // Partial match
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

  // First/Last name match
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

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    // Get first game with odds mapping
    const { data: mappings } = await supabase
      .from('odds_source_mapping')
      .select('game_id, source_game_id, games!inner(home_team_id, away_team_id)')
      .eq('source_type', 'odds_api')
      .limit(1)
      .single();

    if (!mappings?.source_game_id || !mappings.games) {
      return NextResponse.json({
        error: 'No odds source mapping found',
        suggestion: 'Run ESPN season ingestion first'
      });
    }

    const game = mappings.games as unknown as { home_team_id: number; away_team_id: number };

    // Fetch props for this game
    const propData = await fetchPlayerPropsForGame(mappings.source_game_id);
    if (!propData) {
      return NextResponse.json({
        error: 'No props data from Odds API',
        gameId: mappings.source_game_id
      });
    }

    // Extract all unique player names from props
    const playerNamesFromOdds = new Set<string>();
    for (const bookmaker of propData.bookmakers) {
      for (const market of bookmaker.markets) {
        if (!PLAYER_PROP_MARKETS.includes(market.key)) continue;

        for (const outcome of market.outcomes) {
          // Use the same logic as the sync endpoint
          const playerName = outcome.description || outcome.name;
          if (!playerName ||
              playerName === 'Over' ||
              playerName === 'Under' ||
              playerName === 'Yes' ||
              playerName === 'No' ||
              playerName.length < 3) {
            continue;
          }
          playerNamesFromOdds.add(playerName);
        }
      }
    }

    // Get all players from both teams
    const { data: homeTeamPlayers } = await supabase
      .from('team_stats')
      .select('athlete_id, athlete_name, athlete_position')
      .eq('team_id', game.home_team_id)
      .not('athlete_id', 'is', null)
      .not('athlete_name', 'is', null);

    const { data: awayTeamPlayers } = await supabase
      .from('team_stats')
      .select('athlete_id, athlete_name, athlete_position')
      .eq('team_id', game.away_team_id)
      .not('athlete_id', 'is', null)
      .not('athlete_name', 'is', null);

    // Test matching for each Odds API player
    const matchingResults = [];
    for (const oddsPlayerName of Array.from(playerNamesFromOdds)) {
      const homeMatch = await matchPlayerToTeamStats(oddsPlayerName, game.home_team_id);
      const awayMatch = homeMatch ? null : await matchPlayerToTeamStats(oddsPlayerName, game.away_team_id);

      matchingResults.push({
        oddsApiName: oddsPlayerName,
        homeTeamMatch: homeMatch,
        awayTeamMatch: awayMatch,
        matched: !!(homeMatch || awayMatch)
      });
    }

    const matchedCount = matchingResults.filter(r => r.matched).length;
    const unmatchedPlayers = matchingResults.filter(r => !r.matched);

    return NextResponse.json({
      success: true,
      gameInfo: {
        gameId: mappings.game_id,
        oddsGameId: mappings.source_game_id,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id
      },
      summary: {
        totalOddsApiPlayers: playerNamesFromOdds.size,
        totalHomeTeamPlayers: homeTeamPlayers?.length || 0,
        totalAwayTeamPlayers: awayTeamPlayers?.length || 0,
        totalMatched: matchedCount,
        totalUnmatched: playerNamesFromOdds.size - matchedCount
      },
      oddsApiPlayerNames: Array.from(playerNamesFromOdds),
      databasePlayers: {
        homeTeam: (homeTeamPlayers || []).map(p => ({
          id: p.athlete_id,
          name: p.athlete_name,
          position: p.athlete_position
        })),
        awayTeam: (awayTeamPlayers || []).map(p => ({
          id: p.athlete_id,
          name: p.athlete_name,
          position: p.athlete_position
        }))
      },
      matchingResults,
      unmatchedPlayers: unmatchedPlayers.map(p => p.oddsApiName)
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
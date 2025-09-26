import { NextResponse } from 'next/server';

const PLAYER_PROP_MARKETS = [
  'player_pass_yds',
  'player_rush_yds',
  'player_reception_yds',
  'player_anytime_td',
  'player_pass_tds',
  'player_rush_tds'
];

async function testOddsAPI() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return { error: 'ODDS_API_KEY not configured' };
  }

  // Test 1: Get all NFL games (no props)
  const gamesUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${apiKey}&regions=us&markets=h2h`;

  try {
    const gamesResponse = await fetch(gamesUrl);
    if (!gamesResponse.ok) {
      return { error: `Games API failed: ${gamesResponse.status}` };
    }

    const games = await gamesResponse.json();

    if (!games || games.length === 0) {
      return {
        error: 'No NFL games found',
        suggestion: 'This is normal during NFL off-season (March-August)'
      };
    }

    // Test 2: Try to get props for first 3 games
    const propResults = [];
    for (let i = 0; i < Math.min(3, games.length); i++) {
      const game = games[i];
      const markets = PLAYER_PROP_MARKETS.join(',');
      const propsUrl = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${game.id}/odds/?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american`;

      try {
        const propsResponse = await fetch(propsUrl);
        const props = propsResponse.ok ? await propsResponse.json() : null;

        propResults.push({
          gameId: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          commenceTime: game.commence_time,
          propsAvailable: props?.bookmakers?.length > 0,
          propsResponseStatus: propsResponse.status,
          totalBookmakers: props?.bookmakers?.length || 0,
          totalMarkets: props?.bookmakers?.[0]?.markets?.length || 0,
          sampleOutcomes: props?.bookmakers?.[0]?.markets?.[0]?.outcomes?.slice(0, 3) || []
        });
      } catch (err) {
        propResults.push({
          gameId: game.id,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return {
      success: true,
      totalGamesFound: games.length,
      sampleGames: games.slice(0, 3).map((g: { id: string; home_team: string; away_team: string; commence_time: string }) => ({
        id: g.id,
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        commenceTime: g.commence_time
      })),
      playerPropsTest: propResults
    };

  } catch (err) {
    return {
      error: 'API request failed',
      details: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

export async function GET() {
  try {
    const result = await testOddsAPI();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
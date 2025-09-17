import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.log('Error response body:', errorText);
    throw new Error(`Odds API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log('API returned data with length:', data.length);

  return data;
}

async function ensureTeamsAndSeason(supabase: typeof supabaseAdmin) {
  // Ensure we have an NFL sport
  const { data: nflSport, error: sportError } = await supabase
    .from('sports')
    .select('id')
    .eq('name', 'NFL')
    .single();

  let finalNflSport = nflSport;
  if (sportError || !nflSport) {
    const { data: newSport, error: createSportError } = await supabase
      .from('sports')
      .insert({ name: 'NFL' })
      .select('id')
      .single();

    if (createSportError) {
      throw new Error(`Failed to create NFL sport: ${createSportError.message}`);
    }
    finalNflSport = newSport;
  }

  // Find any existing league for NFL to use for seasons
  // If none exists, we'll use the first available league (this is for system sync)
  if (!finalNflSport) {
    throw new Error('NFL sport not found');
  }

  const { data: availableLeague, error: leagueSearchError } = await supabase
    .from('leagues')
    .select('id')
    .eq('sport_id', finalNflSport.id)
    .limit(1)
    .single();

  let leagueId = availableLeague?.id;

  if (leagueSearchError || !availableLeague) {
    // If no leagues exist for NFL, we need to find any league to use as a placeholder
    // This is not ideal but works around the foreign key constraint
    const { data: anyLeague, error: anyLeagueError } = await supabase
      .from('leagues')
      .select('id')
      .limit(1)
      .single();

    if (anyLeagueError || !anyLeague) {
      throw new Error('No leagues exist in the system. Please create at least one league first.');
    }
    leagueId = anyLeague.id;
  }

  // Ensure we have a current season
  const currentYear = new Date().getFullYear();
  const seasonName = `${currentYear} NFL Season`;

  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', seasonName)
    .single();

  let finalSeason = season;
  if (seasonError || !season) {
    const { data: newSeason, error: createSeasonError } = await supabase
      .from('seasons')
      .insert({
        name: seasonName,
        league_id: leagueId,
        start_date: `${currentYear}-09-01`,
        end_date: `${currentYear + 1}-02-28`
      })
      .select('id')
      .single();

    if (createSeasonError) {
      throw new Error(`Failed to create season: ${createSeasonError.message}`);
    }
    finalSeason = newSeason;
  }

  return { sportId: finalNflSport!.id, seasonId: finalSeason!.id };
}

async function ensureTeam(supabase: typeof supabaseAdmin, teamName: string, sportId: number) {
  const { data: team, error } = await supabase
    .from('teams')
    .select('id')
    .eq('name', teamName)
    .eq('sport_id', sportId)
    .single();

  if (error || !team) {
    const { data: newTeam, error: createError } = await supabase
      .from('teams')
      .insert({
        name: teamName,
        sport_id: sportId,
        abbreviation: teamName.substring(0, 3).toUpperCase()
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Failed to create team ${teamName}: ${createError.message}`);
    }
    return newTeam.id;
  }

  return team.id;
}

export async function POST() {
  try {
    console.log('Starting NFL odds sync...');

    const supabase = supabaseAdmin;

    // Fetch games from The Odds API
    const gamesData = await fetchNFLGames();
    console.log(`Fetched ${gamesData.length} games from Odds API`);

    if (gamesData.length === 0) {
      console.log('No games returned from Odds API - may be off-season or between weeks');
      return NextResponse.json({
        success: true,
        message: 'Odds sync endpoint is working',
        timestamp: new Date().toISOString(),
        syncedGames: 0,
        syncedOdds: 0,
        note: 'No games available from Odds API'
      });
    }

    // Ensure we have the necessary sport and season records
    const { sportId, seasonId } = await ensureTeamsAndSeason(supabase);

    let syncedGames = 0;
    let syncedOdds = 0;

    for (const gameData of gamesData) {
      try {
        // Ensure both teams exist
        const homeTeamId = await ensureTeam(supabase, gameData.home_team, sportId);
        const awayTeamId = await ensureTeam(supabase, gameData.away_team, sportId);

        // Check if game already exists
        const { data: existingGame, error: gameCheckError } = await supabase
          .from('games')
          .select('id')
          .eq('season_id', seasonId)
          .eq('home_team_id', homeTeamId)
          .eq('away_team_id', awayTeamId)
          .eq('start_time', gameData.commence_time)
          .single();

        let gameId;

        if (gameCheckError || !existingGame) {
          // Create new game
          const { data: newGame, error: createGameError } = await supabase
            .from('games')
            .insert({
              season_id: seasonId,
              home_team_id: homeTeamId,
              away_team_id: awayTeamId,
              start_time: gameData.commence_time,
              status: 'scheduled'
            })
            .select('id')
            .single();

          if (createGameError) {
            console.error(`Failed to create game: ${createGameError.message}`);
            continue;
          }

          gameId = newGame.id;
          syncedGames++;
        } else {
          gameId = existingGame.id;
        }

        // Process odds from bookmakers
        for (const bookmaker of gameData.bookmakers) {
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
              const homeOutcome = market.outcomes.find(o => o.name === gameData.home_team);
              const awayOutcome = market.outcomes.find(o => o.name === gameData.away_team);
              moneylineHome = homeOutcome?.price || null;
              moneylineAway = awayOutcome?.price || null;
            } else if (market.key === 'spreads') {
              // Point spreads
              const homeOutcome = market.outcomes.find(o => o.name === gameData.home_team);
              const awayOutcome = market.outcomes.find(o => o.name === gameData.away_team);
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
            console.error(`Failed to insert odds: ${oddsError.message}`);
          } else {
            syncedOdds++;
          }
        }
      } catch (gameError) {
        console.error(`Error processing game ${gameData.id}:`, gameError);
        continue;
      }
    }

    console.log(`Sync complete. Games: ${syncedGames}, Odds: ${syncedOdds}`);

    return NextResponse.json({
      success: true,
      message: 'NFL odds sync completed',
      timestamp: new Date().toISOString(),
      syncedGames,
      syncedOdds,
      totalGamesFromAPI: gamesData.length
    });

  } catch (error) {
    console.error('Sync odds error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
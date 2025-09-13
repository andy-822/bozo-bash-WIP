import { GameWithOdds } from '@/hooks/useGamesWithOdds';

export interface GameData {
  id: string;
  time: string;
  awayTeam: string;
  awayLogo: string;
  homeTeam: string;
  homeLogo: string;
  spread: string;
  total: string;
  moneyline: string;
  hasPick: boolean;
}

// Convert team name to short logo code
function getTeamLogo(teamName: string): string {
  const logoMap: Record<string, string> = {
    // AFC East
    'Buffalo Bills': 'BUF',
    'Miami Dolphins': 'MIA', 
    'New England Patriots': 'NE',
    'New York Jets': 'NYJ',
    
    // AFC North
    'Baltimore Ravens': 'BAL',
    'Cincinnati Bengals': 'CIN',
    'Cleveland Browns': 'CLE',
    'Pittsburgh Steelers': 'PIT',
    
    // AFC South
    'Houston Texans': 'HOU',
    'Indianapolis Colts': 'IND',
    'Jacksonville Jaguars': 'JAX',
    'Tennessee Titans': 'TEN',
    
    // AFC West
    'Denver Broncos': 'DEN',
    'Kansas City Chiefs': 'KC',
    'Las Vegas Raiders': 'LV',
    'Los Angeles Chargers': 'LAC',
    
    // NFC East
    'Dallas Cowboys': 'DAL',
    'New York Giants': 'NYG',
    'Philadelphia Eagles': 'PHI',
    'Washington Commanders': 'WAS',
    
    // NFC North
    'Chicago Bears': 'CHI',
    'Detroit Lions': 'DET',
    'Green Bay Packers': 'GB',
    'Minnesota Vikings': 'MIN',
    
    // NFC South
    'Atlanta Falcons': 'ATL',
    'Carolina Panthers': 'CAR',
    'New Orleans Saints': 'NO',
    'Tampa Bay Buccaneers': 'TB',
    
    // NFC West
    'Arizona Cardinals': 'ARI',
    'Los Angeles Rams': 'LAR',
    'San Francisco 49ers': 'SF',
    'Seattle Seahawks': 'SEA'
  };
  
  return logoMap[teamName] || teamName.substring(0, 3).toUpperCase();
}

// Format odds number to display format
function formatOdds(price: number): string {
  if (price > 0) {
    return `+${price}`;
  }
  return price.toString();
}

// Get the best odds for a specific market and outcome
function getBestOdds(odds: GameWithOdds['odds'], marketType: string, outcomeName: string): number | null {
  const marketOdds = odds.filter(o => o.market_type === marketType);
  
  for (const odd of marketOdds) {
    const outcomes = odd.outcomes as any[];
    const outcome = outcomes.find(o => o.name === outcomeName);
    if (outcome) {
      return outcome.price;
    }
  }
  return null;
}

// Get spread information
function getSpreadInfo(odds: GameWithOdds['odds'], teamName: string): { team: string; spread: number; price: number } | null {
  const spreadOdds = odds.filter(o => o.market_type === 'spreads');
  
  for (const odd of spreadOdds) {
    const outcomes = odd.outcomes as any[];
    const outcome = outcomes.find(o => o.name === teamName);
    if (outcome && outcome.point !== undefined) {
      return {
        team: teamName,
        spread: outcome.point,
        price: outcome.price
      };
    }
  }
  return null;
}

// Get totals information  
function getTotalsInfo(odds: GameWithOdds['odds']): { total: number; overPrice: number; underPrice: number } | null {
  const totalsOdds = odds.filter(o => o.market_type === 'totals');
  
  for (const odd of totalsOdds) {
    const outcomes = odd.outcomes as any[];
    const over = outcomes.find(o => o.name === 'Over');
    const under = outcomes.find(o => o.name === 'Under');
    
    if (over && under && over.point !== undefined) {
      return {
        total: over.point,
        overPrice: over.price,
        underPrice: under.price
      };
    }
  }
  return null;
}

export function formatGameData(gameWithOdds: GameWithOdds): GameData {
  const game = gameWithOdds;
  
  // Format game time
  const gameDate = new Date(game.game_time);
  const time = gameDate.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  // Get team logos
  const awayLogo = getTeamLogo(game.away_team);
  const homeLogo = getTeamLogo(game.home_team);
  
  // Get best moneyline odds
  const homeMoneyline = getBestOdds(game.odds, 'h2h', game.home_team);
  const awayMoneyline = getBestOdds(game.odds, 'h2h', game.away_team);
  
  // Format moneyline display
  let moneylineDisplay = 'No odds';
  if (homeMoneyline && awayMoneyline) {
    // Show the underdog (positive odds) or if both negative, show away team
    if (awayMoneyline > homeMoneyline) {
      moneylineDisplay = `${awayLogo} ${formatOdds(awayMoneyline)}`;
    } else {
      moneylineDisplay = `${homeLogo} ${formatOdds(homeMoneyline)}`;
    }
  }
  
  // Get spread information
  const homeSpread = getSpreadInfo(game.odds, game.home_team);
  const awaySpread = getSpreadInfo(game.odds, game.away_team);
  
  let spreadDisplay = 'No spread';
  if (homeSpread && homeSpread.spread < 0) {
    spreadDisplay = `${homeLogo} ${homeSpread.spread}`;
  } else if (awaySpread && awaySpread.spread < 0) {
    spreadDisplay = `${awayLogo} ${awaySpread.spread}`;
  }
  
  // Get totals information
  const totals = getTotalsInfo(game.odds);
  let totalDisplay = 'No total';
  if (totals) {
    totalDisplay = `O/U ${totals.total}`;
  }
  
  return {
    id: game.id,
    time,
    awayTeam: game.away_team,
    awayLogo,
    homeTeam: game.home_team,
    homeLogo,
    spread: spreadDisplay,
    total: totalDisplay,
    moneyline: moneylineDisplay,
    hasPick: gameWithOdds.hasPick || false
  };
}
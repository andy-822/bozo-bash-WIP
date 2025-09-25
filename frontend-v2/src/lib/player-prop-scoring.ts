interface PlayerPropResult {
  athleteId: string;
  marketKey: string;
  actualValue: number;
}

interface PlayerProp {
  id: number;
  athlete_id: string;
  market_key: string;
  point?: number;
}

interface PlayerPropPick {
  id: number;
  player_prop_id: number;
  selection: string;
  bet_type: string;
}

export function scorePlayerProp(
  pick: PlayerPropPick,
  prop: PlayerProp,
  result: PlayerPropResult
): 'win' | 'loss' | 'push' | 'void' {
  if (!prop.point) {
    if (prop.market_key.includes('anytime_td') ||
        prop.market_key.includes('1st_td') ||
        prop.market_key.includes('last_td')) {
      return result.actualValue > 0 ? 'win' : 'loss';
    }
    return 'void';
  }

  const actualValue = result.actualValue;
  const line = prop.point;

  if (pick.selection.toLowerCase().includes('over')) {
    if (actualValue > line) return 'win';
    if (actualValue < line) return 'loss';
    return 'push';
  }

  if (pick.selection.toLowerCase().includes('under')) {
    if (actualValue < line) return 'win';
    if (actualValue > line) return 'loss';
    return 'push';
  }

  return 'void';
}

export const MARKET_STAT_MAPPING: Record<string, string> = {
  'player_pass_yds': 'passing_yards',
  'player_pass_tds': 'passing_touchdowns',
  'player_pass_attempts': 'passing_attempts',
  'player_pass_completions': 'passing_completions',
  'player_pass_interceptions': 'passing_interceptions',
  'player_rush_yds': 'rushing_yards',
  'player_rush_tds': 'rushing_touchdowns',
  'player_rush_attempts': 'rushing_attempts',
  'player_reception_yds': 'receiving_yards',
  'player_reception_tds': 'receiving_touchdowns',
  'player_receptions': 'receptions',
  'player_anytime_td': 'total_touchdowns',
  'player_sacks': 'sacks',
  'player_tackles_assists': 'total_tackles'
};

export async function getPlayerStatFromESPN(
  athleteId: string,
  gameId: number,
  marketKey: string
): Promise<number | null> {
  const statType = MARKET_STAT_MAPPING[marketKey];
  if (!statType) {
    console.warn(`No stat mapping found for market key: ${marketKey}`);
    return null;
  }

  return null;
}

export function parsePlayerPropSelection(selection: string): {
  playerName: string;
  marketKey: string;
  betType: 'over' | 'under' | 'anytime';
  point?: number;
} | null {
  const parts = selection.split(' ');
  if (parts.length < 3) return null;

  const playerName = parts[0] + ' ' + parts[1];
  const marketKey = parts[2];
  const betType = parts[3]?.toLowerCase() as 'over' | 'under' | 'anytime';
  const point = parts[4] ? parseFloat(parts[4]) : undefined;

  return {
    playerName,
    marketKey,
    betType,
    point
  };
}
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ESPNGame, ESPNGameStatus, ESPNCompetitor } from '@/lib/espn-monitor';

/**
 * Live Score Sync API
 * POST /api/cron/sync-live-scores
 *
 * Fetches current scores and clock info from ESPN for live games
 * and updates the games table with real-time data.
 */

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

export async function POST(request: NextRequest) {
  try {
    console.log('🏈 Starting live score sync...');

    // Security: Check for cron secret (same pattern as existing scoring endpoint)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Get all live games from our database
    const { data: liveGames, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('id, espn_game_id, home_team_id, away_team_id, status')
      .in('status', ['live', 'scheduled']) // Include scheduled in case status is stale
      .not('espn_game_id', 'is', null);

    if (gamesError) {
      console.error('Error fetching live games:', gamesError);
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }

    if (!liveGames || liveGames.length === 0) {
      console.log('No live games found');
      return NextResponse.json({
        message: 'No live games to sync',
        processed: 0
      });
    }

    console.log(`Found ${liveGames.length} potential live games`);

    // Step 2: Fetch current scoreboard from ESPN
    const espnResponse = await fetch(`${ESPN_API_BASE}/scoreboard`);
    if (!espnResponse.ok) {
      throw new Error(`ESPN API failed: ${espnResponse.status}`);
    }

    const espnData = await espnResponse.json();
    const espnEvents: ESPNGame[] = espnData.events || [];

    console.log(`Fetched ${espnEvents.length} games from ESPN`);

    // Step 3: Process each live game
    let updatedCount = 0;
    const updates = [];

    for (const game of liveGames) {
      if (!game.espn_game_id) continue;

      // Find matching ESPN game
      const espnGame = espnEvents.find(event => event.id === game.espn_game_id);
      if (!espnGame || !espnGame.competitions?.[0]) {
        console.log(`ESPN game not found for ID: ${game.espn_game_id}`);
        continue;
      }

      const competition = espnGame.competitions[0];
      const status: ESPNGameStatus = competition.status;
      const competitors: ESPNCompetitor[] = competition.competitors || [];

      // Extract scores and game state
      const homeCompetitor = competitors.find(c => c.homeAway === 'home');
      const awayCompetitor = competitors.find(c => c.homeAway === 'away');

      if (!homeCompetitor || !awayCompetitor) {
        console.log(`Missing competitors for game ${game.espn_game_id}`);
        continue;
      }

      // Determine if this game needs updating
      const isLive = status.type.state === 'in';
      const isCompleted = status.type.completed;
      const hasScoreUpdate = homeCompetitor.score || awayCompetitor.score;

      if (!isLive && !isCompleted && !hasScoreUpdate) {
        // Game is still scheduled with no score changes
        continue;
      }

      // Prepare update data
      const updateData: {
        home_score: number;
        away_score: number;
        clock: number;
        display_clock: string;
        period: number;
        status_detail: string;
        last_updated: string;
        status?: string;
      } = {
        home_score: parseInt(homeCompetitor.score) || 0,
        away_score: parseInt(awayCompetitor.score) || 0,
        clock: status.clock || 0,
        display_clock: status.displayClock || '0:00',
        period: status.period || 0,
        status_detail: status.type.detail || status.type.description,
        last_updated: new Date().toISOString()
      };

      // Update status
      if (isCompleted) {
        updateData.status = 'completed';
      } else if (isLive) {
        updateData.status = 'live';
      }

      // Store for batch update
      updates.push({
        id: game.id,
        ...updateData
      });

      console.log(`Queued update for game ${game.id}: ${awayCompetitor.score}-${homeCompetitor.score} (${status.displayClock})`);
    }

    // Step 4: Batch update all games
    if (updates.length > 0) {
      for (const update of updates) {
        const { id, ...updateFields } = update;

        const { error: updateError } = await supabaseAdmin
          .from('games')
          .update(updateFields)
          .eq('id', id);

        if (updateError) {
          console.error(`Failed to update game ${id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }

    console.log(`✅ Live score sync complete. Updated ${updatedCount} games.`);

    return NextResponse.json({
      message: 'Live score sync completed',
      processed: liveGames.length,
      updated: updatedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Live score sync failed:', error);
    return NextResponse.json({
      error: 'Live score sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Allow GET for testing/manual trigger
export async function GET(request: NextRequest) {
  return POST(request);
}
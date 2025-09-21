import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ESPNGame, ESPNGameStatus } from '@/lib/espn-monitor';

/**
 * Game Status Monitor API
 * POST /api/cron/sync-game-status
 *
 * Monitors game status transitions: scheduled → live → completed
 * This is crucial for pick deadline enforcement and UI state management.
 */

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

export async function POST(request: NextRequest) {
  try {
    console.log('📊 Starting game status monitor...');

    // Security: Check for cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Get games that might need status updates
    // Focus on games from today and next 24 hours to avoid unnecessary API calls
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: games, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('id, espn_game_id, status, start_time')
      .not('espn_game_id', 'is', null)
      .gte('start_time', yesterday.toISOString())
      .lte('start_time', tomorrow.toISOString())
      .not('status', 'eq', 'completed'); // Skip already completed games

    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }

    if (!games || games.length === 0) {
      console.log('No games found for status monitoring');
      return NextResponse.json({
        message: 'No games to monitor',
        processed: 0
      });
    }

    console.log(`Monitoring ${games.length} games for status changes`);

    // Step 2: Fetch current scoreboard from ESPN
    const espnResponse = await fetch(`${ESPN_API_BASE}/scoreboard`);
    if (!espnResponse.ok) {
      throw new Error(`ESPN API failed: ${espnResponse.status}`);
    }

    const espnData = await espnResponse.json();
    const espnEvents: ESPNGame[] = espnData.events || [];

    console.log(`Fetched ${espnEvents.length} games from ESPN scoreboard`);

    // Step 3: Check each game for status changes
    let statusChanges = 0;
    const updates = [];

    for (const game of games) {
      if (!game.espn_game_id) continue;

      // Find matching ESPN game
      const espnGame = espnEvents.find(event => event.id === game.espn_game_id);
      if (!espnGame || !espnGame.competitions?.[0]) {
        // Game might not be in today's scoreboard - check if it should be completed
        const gameTime = new Date(game.start_time);
        const hoursAgo = (now.getTime() - gameTime.getTime()) / (1000 * 60 * 60);

        if (hoursAgo > 4 && game.status !== 'completed') {
          // Game started over 4 hours ago and not marked completed - likely finished
          console.log(`Marking game ${game.id} as completed (started ${hoursAgo.toFixed(1)}h ago)`);
          updates.push({
            id: game.id,
            status: 'completed',
            status_detail: 'Final',
            last_updated: new Date().toISOString()
          });
        }
        continue;
      }

      const competition = espnGame.competitions[0];
      const status: ESPNGameStatus = competition.status;

      // Determine new status based on ESPN data
      let newStatus = game.status;
      let statusDetail = status.type.detail || status.type.description;

      if (status.type.completed) {
        newStatus = 'completed';
        statusDetail = 'Final';
      } else if (status.type.state === 'in') {
        newStatus = 'live';
      } else if (status.type.state === 'pre') {
        newStatus = 'scheduled';
      }

      // Check if status changed
      if (newStatus !== game.status) {
        console.log(`Status change detected for game ${game.id}: ${game.status} → ${newStatus}`);

        updates.push({
          id: game.id,
          status: newStatus,
          status_detail: statusDetail,
          last_updated: new Date().toISOString()
        });

        statusChanges++;
      }
    }

    // Step 4: Apply status updates
    if (updates.length > 0) {
      for (const update of updates) {
        const { id, ...updateFields } = update;

        const { error: updateError } = await supabaseAdmin
          .from('games')
          .update(updateFields)
          .eq('id', id);

        if (updateError) {
          console.error(`Failed to update game status for ${id}:`, updateError);
        } else {
          console.log(`✅ Updated game ${id} status to: ${update.status}`);
        }
      }
    }

    // Step 5: Log summary
    if (statusChanges > 0) {
      console.log(`🎯 Status monitor complete: ${statusChanges} games updated`);
    } else {
      console.log('📊 Status monitor complete: No status changes detected');
    }

    return NextResponse.json({
      message: 'Game status monitoring completed',
      processed: games.length,
      statusChanges,
      updates: updates.map(u => ({
        gameId: u.id,
        newStatus: u.status
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Game status monitoring failed:', error);
    return NextResponse.json({
      error: 'Game status monitoring failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Allow GET for testing/manual trigger
export async function GET(request: NextRequest) {
  return POST(request);
}
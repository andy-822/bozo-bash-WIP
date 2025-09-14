// API Route for syncing odds data
// This can be called manually or by a cron service like Vercel Cron

import { NextResponse } from 'next/server';
import { oddsAPI } from '@/lib/odds-api';

// POST /api/sync-odds
export async function POST(request: Request) {
  try {
    // Optional: Add authentication for security
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await oddsAPI.syncNFLOdds();

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Successfully synced odds for ${result.gamesProcessed} games`
        : `Sync failed: ${result.error}`,
      gamesProcessed: result.gamesProcessed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Odds sync API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET /api/sync-odds - Check sync status
export async function GET() {
  try {
    const currentUsage = await oddsAPI.getCurrentMonthUsage();
    const canMakeRequest = await oddsAPI.shouldMakeRequest();

    return NextResponse.json({
      currentMonthUsage: currentUsage,
      remainingRequests: 500 - currentUsage,
      canMakeRequest,
      nextSyncRecommended: canMakeRequest ? 'Now' : 'Usage limit approaching'
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
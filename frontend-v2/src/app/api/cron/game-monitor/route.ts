import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron Job endpoint for automated game scoring
 *
 * Configure in vercel.json:
 * {
 *   "cron": [
 *     {
 *       "path": "/api/cron/game-monitor",
 *       "schedule": "0,15,30,45 * * * *"
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  console.log('Cron job triggered: game-monitor');

  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Unauthorized cron job attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Call our automated scoring endpoint
    const scoringUrl = new URL('/api/scoring/auto', request.url);

    const response = await fetch(scoringUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward any authentication if needed
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Automated scoring failed:', result);
      return NextResponse.json({
        success: false,
        error: 'Scoring endpoint failed',
        details: result,
      }, { status: 500 });
    }

    console.log('Cron job completed successfully:', result.summary);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });

  } catch (error) {
    console.error('Cron job failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Cron job execution failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Also support POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({
        error: 'CRON_SECRET not configured'
      }, { status: 500 });
    }

    const providedSecret = authHeader?.replace('Bearer ', '') ||
                          request.headers.get('x-cron-secret');

    if (!providedSecret || providedSecret !== cronSecret) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://bozo-bash.vercel.app';

    const response = await fetch(`${baseUrl}/api/sync-player-props`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Player props sync failed: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Player props sync triggered successfully',
      timestamp: new Date().toISOString(),
      syncResult: data
    });

  } catch (error) {
    console.error('Cron player props sync error:', error);
    return NextResponse.json({
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
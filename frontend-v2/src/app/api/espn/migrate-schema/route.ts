import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rateLimitESPNMigration } from '@/lib/rate-limit';

/**
 * ESPN Schema Migration API
 * POST /api/espn/migrate-schema
 *
 * Executes the database schema changes for the ESPN Architecture Refactor
 * This is a one-time migration that should be run before the season ingestion
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimitESPNMigration(ip);

    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: 'Too many requests',
        message: 'Rate limit exceeded for schema migration endpoint',
        reset: new Date(rateLimitResult.reset).toISOString()
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString()
        }
      });
    }

    // CRON secret validation (optional but recommended)
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '') ||
                          request.headers.get('x-cron-secret');

    if (cronSecret && providedSecret && providedSecret !== cronSecret) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Invalid CRON secret'
      }, { status: 401 });
    }

    // Require authentication for production security
    if (!cronSecret) {
      return NextResponse.json({
        error: 'Configuration Error',
        message: 'CRON_SECRET environment variable must be configured'
      }, { status: 500 });
    }

    if (!providedSecret) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'CRON secret required. Provide via Authorization header or x-cron-secret header'
      }, { status: 401 });
    }

    console.log('Starting ESPN schema migration...');

    const migrationSteps = [];

    // Phase 1: Check current table structure (schema changes need to be done manually)
    console.log('Phase 1: Checking games table structure...');
    // Note: Supabase doesn't support DDL via RPC in this setup
    // Schema changes should be applied manually via SQL or Supabase dashboard
    migrationSteps.push('Schema changes require manual SQL execution');

    // Phase 2: Check if schema changes are needed
    console.log('Phase 2: Validating current schema...');

    // Phase 4: Check current schema
    const { data: gamesStructure, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('*')
      .limit(1);

    if (gamesError) {
      throw new Error(`Failed to check games table: ${gamesError.message}`);
    }

    // Check if ESPN columns exist
    const sampleGame = gamesStructure?.[0];
    const hasEspnGameId = sampleGame && 'espn_game_id' in sampleGame;
    const hasVenueName = sampleGame && 'venue_name' in sampleGame;
    const hasWeek = sampleGame && 'week' in sampleGame;

    migrationSteps.push(`ESPN Game ID column exists: ${hasEspnGameId}`);
    migrationSteps.push(`Venue name column exists: ${hasVenueName}`);
    migrationSteps.push(`Week column exists: ${hasWeek}`);

    // Check odds table structure
    const { error: oddsError } = await supabaseAdmin
      .from('odds')
      .select('*')
      .limit(1);

    migrationSteps.push(`Odds table accessible: ${!oddsError}`);

    return NextResponse.json({
      success: true,
      message: 'ESPN schema migration assessment completed',
      timestamp: new Date().toISOString(),
      migrationSteps,
      schemaStatus: {
        gamesTable: {
          hasEspnGameId,
          hasVenueName,
          hasWeek,
        },
        oddsTable: {
          accessible: !oddsError,
        },
      },
      nextSteps: [
        'Run full SQL migration script manually if needed',
        'Execute ESPN season ingestion: POST /api/espn/ingest-season',
        'Verify data completeness',
        'Update odds seeding process',
      ],
    });

  } catch (error) {
    console.error('ESPN schema migration failed:', error);

    return NextResponse.json({
      success: false,
      error: 'ESPN schema migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Get migration status and schema information
 */
export async function GET() {
  try {
    // Check current schema status
    const { data: gamesStructure } = await supabaseAdmin
      .from('games')
      .select('*')
      .limit(1);

    const { data: teamsStructure } = await supabaseAdmin
      .from('teams')
      .select('*')
      .limit(1);

    const { data: gamesWithEspnId } = await supabaseAdmin
      .from('games')
      .select('id')
      .not('espn_game_id', 'is', null);

    const { data: totalGames } = await supabaseAdmin
      .from('games')
      .select('id');

    const sampleGame = gamesStructure?.[0];
    const sampleTeam = teamsStructure?.[0];

    return NextResponse.json({
      success: true,
      schemaStatus: {
        gamesTable: {
          hasEspnGameId: sampleGame && 'espn_game_id' in sampleGame,
          hasEspnEventName: sampleGame && 'espn_event_name' in sampleGame,
          hasVenueName: sampleGame && 'venue_name' in sampleGame,
          hasWeek: sampleGame && 'week' in sampleGame,
        },
        teamsTable: {
          hasEspnTeamId: sampleTeam && 'espn_team_id' in sampleTeam,
        },
        dataStatus: {
          totalGames: totalGames?.length || 0,
          gamesWithEspnId: gamesWithEspnId?.length || 0,
          espnIdCoverage: totalGames?.length
            ? Math.round((gamesWithEspnId?.length || 0) * 100 / totalGames.length)
            : 0,
        },
      },
      migrationNeeded: !sampleGame || !('espn_game_id' in sampleGame),
    });

  } catch (error) {
    console.error('Failed to check migration status:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to check migration status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    // Test if player_props table exists
    const { data, error } = await supabase
      .from('player_props')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'player_props table does not exist or is not accessible',
        details: error.message,
        action: 'Run the database migration from player-props-migration.sql'
      });
    }

    // Test if we can query related tables
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    const { data: teamStatsData, error: teamStatsError } = await supabase
      .from('team_stats')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    return NextResponse.json({
      success: true,
      message: 'player_props table exists and is accessible',
      tableStatus: {
        player_props: { exists: true, count: data },
        games: { exists: !gamesError, count: gamesData },
        team_stats: { exists: !teamStatsError, count: teamStatsData }
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
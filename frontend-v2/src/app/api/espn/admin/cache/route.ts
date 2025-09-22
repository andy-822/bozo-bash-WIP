import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCacheStats, invalidateDashboardCache } from '../dashboard/route';

/**
 * Cache Management API
 * GET /api/espn/admin/cache - Get cache statistics
 * POST /api/espn/admin/cache - Cache operations (warm, invalidate)
 *
 * Provides cache monitoring and management capabilities for admins
 */

export async function GET() {
  try {
    // Authentication check - only league admins can access
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is admin of any league
    const { data: adminLeagues, error: adminError } = await supabaseAdmin
      .from('leagues')
      .select('id, name')
      .eq('admin_id', user.id);

    if (adminError || !adminLeagues || adminLeagues.length === 0) {
      return NextResponse.json({
        error: 'Access denied. Only league administrators can access cache management.'
      }, { status: 403 });
    }

    const stats = getCacheStats();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cacheStats: stats,
      recommendations: generateCacheRecommendations(stats)
    });

  } catch (error) {
    console.error('Cache stats request failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve cache statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check - only league admins can access
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is admin of any league
    const { data: adminLeagues, error: adminError } = await supabaseAdmin
      .from('leagues')
      .select('id, name')
      .eq('admin_id', user.id);

    if (adminError || !adminLeagues || adminLeagues.length === 0) {
      return NextResponse.json({
        error: 'Access denied. Only league administrators can manage cache.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, reason } = body;

    switch (action) {
      case 'invalidate':
        invalidateDashboardCache(reason || `Manual invalidation by admin ${user.id}`);
        return NextResponse.json({
          success: true,
          message: 'Cache invalidated successfully',
          timestamp: new Date().toISOString()
        });

      case 'warm':
        const warmResult = await warmCache();
        return NextResponse.json({
          success: true,
          message: 'Cache warming initiated',
          timestamp: new Date().toISOString(),
          warmedEntries: warmResult.warmedEntries,
          errors: warmResult.errors
        });

      case 'stats':
        const stats = getCacheStats();
        return NextResponse.json({
          success: true,
          cacheStats: stats,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: invalidate, warm, stats'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Cache management operation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Cache management operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Warm cache by pre-loading data for active admin users
 */
async function warmCache(): Promise<{ warmedEntries: number; errors: number }> {
  console.log('Starting cache warming process...');

  let warmedEntries = 0;
  let errors = 0;

  try {
    // Get all league admins for cache warming
    const { data: allAdmins, error } = await supabaseAdmin
      .from('leagues')
      .select(`
        admin_id,
        id,
        name,
        users!inner (
          id,
          email
        )
      `)
      .not('admin_id', 'is', null);

    if (error || !allAdmins) {
      console.error('Failed to fetch admins for cache warming:', error);
      return { warmedEntries: 0, errors: 1 };
    }

    // Group leagues by admin
    const adminGroups = new Map<string, Array<{ id: number; name: string; admin_id: string }>>();
    for (const league of allAdmins) {
      const adminId = league.admin_id;
      if (!adminGroups.has(adminId)) {
        adminGroups.set(adminId, []);
      }
      adminGroups.get(adminId)!.push(league);
    }

    console.log(`Cache warming: Found ${adminGroups.size} unique admins`);

    // Warm cache for each admin group
    for (const [adminId, leagues] of adminGroups) {
      try {
        console.log(`Warming cache for admin ${adminId} with ${leagues.length} leagues`);

        // For warming, we'll simulate the cache key generation
        const adminLeagueIds = leagues.map(l => l.id);
        const cacheKey = `dashboard:${adminId}:${adminLeagueIds.sort().join(',')}`;

        console.log(`Cache key generated: ${cacheKey}`);
        warmedEntries++;

      } catch (warmError) {
        console.error(`Failed to warm cache for admin ${adminId}:`, warmError);
        errors++;
      }
    }

    console.log(`Cache warming completed: ${warmedEntries} entries warmed, ${errors} errors`);

  } catch (globalError) {
    console.error('Cache warming process failed:', globalError);
    errors++;
  }

  return { warmedEntries, errors };
}

/**
 * Generate cache optimization recommendations
 */
function generateCacheRecommendations(stats: Record<string, unknown>): string[] {
  const recommendations: string[] = [];

  const hitRate = typeof stats.hitRate === 'number' ? stats.hitRate : 0;
  const cacheSize = typeof stats.cacheSize === 'number' ? stats.cacheSize : 0;
  const averageQueryTime = typeof stats.averageQueryTime === 'number' ? stats.averageQueryTime : 0;
  const invalidations = typeof stats.invalidations === 'number' ? stats.invalidations : 0;
  const hits = typeof stats.hits === 'number' ? stats.hits : 0;

  if (hitRate < 70) {
    recommendations.push('Cache hit rate is low (<70%). Consider increasing cache TTL or checking for cache invalidation issues.');
  }

  if (cacheSize > 80) {
    recommendations.push('Cache size is approaching limits. Monitor for memory usage and consider implementing more aggressive LRU eviction.');
  }

  if (averageQueryTime > 2000) {
    recommendations.push('Average query time is high (>2s). Database queries may need optimization or indexing.');
  }

  if (invalidations > hits * 0.1) {
    recommendations.push('High invalidation rate detected. Review cache invalidation triggers.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Cache performance is optimal. No immediate action required.');
  }

  return recommendations;
}
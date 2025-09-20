import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getMatchingStatistics } from '@/lib/game-matching';

// Enhanced cache configuration for dashboard data
interface DashboardCache {
  data: DashboardData;
  etag: string;
  timestamp: number;
  expiresAt: number;
  softExpiresAt: number; // For stale-while-revalidate strategy
  accessCount: number;
  lastAccessed: number;
  dataVersion: number; // For cache invalidation
}

interface DashboardData {
  success: boolean;
  timestamp: string;
  userInfo?: {
    id: string;
    adminOfLeagues: string[];
  };
  architecture: {
    status: string;
    version: string;
    description: string;
  };
  schemaStatus: Record<string, unknown>;
  dataStatus: Record<string, unknown>;
  matchingStats: Record<string, unknown>;
  espnApiStats: Record<string, unknown>;
  recentActivity: Record<string, unknown>;
  healthChecks: Record<string, boolean>;
  nextSteps: string[];
  _metadata: {
    queryTimeMs: number;
    cacheStatus: string;
    cacheStats?: Record<string, unknown>;
  };
}

interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
  totalRequests: number;
  averageQueryTime: number;
}

const dashboardCache = new Map<string, DashboardCache>();
const cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  totalRequests: 0,
  averageQueryTime: 0
};

// Enhanced cache configuration
const CACHE_CONFIG = {
  HARD_TTL: 5 * 60 * 1000,        // 5 minutes hard cache
  SOFT_TTL: 3 * 60 * 1000,        // 3 minutes soft cache (stale-while-revalidate)
  MAX_CACHE_SIZE: 100,             // Maximum cache entries
  CLEANUP_INTERVAL: 2 * 60 * 1000, // Cleanup every 2 minutes
  HOT_DATA_TTL: 2 * 60 * 1000,     // Frequently accessed data (2 minutes)
  COLD_DATA_TTL: 10 * 60 * 1000,   // Rarely accessed data (10 minutes)
};

let currentDataVersion = 1; // Global version for cache invalidation

/**
 * Enhanced cache cleanup with LRU eviction
 */
function performCacheCleanup() {
  const now = Date.now();
  const entries = Array.from(dashboardCache.entries());

  // Remove expired entries
  let expiredCount = 0;
  for (const [key, cache] of entries) {
    if (cache.expiresAt < now) {
      dashboardCache.delete(key);
      expiredCount++;
    }
  }

  // If cache is still over limit, perform LRU eviction
  if (dashboardCache.size > CACHE_CONFIG.MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(dashboardCache.entries())
      .sort((a, b) => {
        // Sort by access frequency and recency
        const scoreA = a[1].accessCount * Math.max(0, 1 - (now - a[1].lastAccessed) / (24 * 60 * 60 * 1000));
        const scoreB = b[1].accessCount * Math.max(0, 1 - (now - b[1].lastAccessed) / (24 * 60 * 60 * 1000));
        return scoreA - scoreB;
      });

    const toRemove = sortedEntries.slice(0, dashboardCache.size - CACHE_CONFIG.MAX_CACHE_SIZE + 10);
    toRemove.forEach(([key]) => dashboardCache.delete(key));
  }

  if (expiredCount > 0) {
    console.log(`Cache cleanup: removed ${expiredCount} expired entries, cache size: ${dashboardCache.size}`);
  }
}

// Enhanced cleanup with performance monitoring
setInterval(performCacheCleanup, CACHE_CONFIG.CLEANUP_INTERVAL);

/**
 * Generate cache key based on user context and data sensitivity
 */
function generateCacheKey(userId: string, adminLeagueIds: number[]): string {
  // Cache key includes user ID and league IDs to ensure data isolation
  const leagueKey = adminLeagueIds.sort().join(',');
  return `dashboard:${userId}:${leagueKey}`;
}

/**
 * Generate ETag for response caching
 */
function generateETag(data: DashboardData, timestamp: number): string {
  // Create a hash-like string based on data and timestamp
  const dataString = JSON.stringify(data);
  const hash = dataString.length + timestamp.toString(36);
  return `"${hash}"`;
}

/**
 * Adaptive TTL based on access patterns
 */
function calculateTTL(accessCount: number, isHot: boolean): number {
  if (isHot || accessCount > 5) {
    return CACHE_CONFIG.HOT_DATA_TTL; // Frequently accessed data
  }
  if (accessCount <= 1) {
    return CACHE_CONFIG.COLD_DATA_TTL; // Rarely accessed data
  }
  return CACHE_CONFIG.HARD_TTL; // Standard cache duration
}

/**
 * Get cached data with stale-while-revalidate strategy
 */
function getCachedData(cacheKey: string, ifNoneMatch?: string): { cache: DashboardCache | null; shouldRevalidate: boolean } {
  cacheStats.totalRequests++;

  const cached = dashboardCache.get(cacheKey);

  if (!cached) {
    cacheStats.misses++;
    return { cache: null, shouldRevalidate: false };
  }

  const now = Date.now();

  // Check if data version is current (for cache invalidation)
  if (cached.dataVersion < currentDataVersion) {
    console.log(`Cache invalidated for key ${cacheKey}: version ${cached.dataVersion} < ${currentDataVersion}`);
    dashboardCache.delete(cacheKey);
    cacheStats.invalidations++;
    cacheStats.misses++;
    return { cache: null, shouldRevalidate: false };
  }

  // Update access tracking
  cached.accessCount++;
  cached.lastAccessed = now;

  // Hard expiration check
  if (cached.expiresAt < now) {
    dashboardCache.delete(cacheKey);
    cacheStats.misses++;
    return { cache: null, shouldRevalidate: false };
  }

  // Check if client has the same version (ETag match)
  if (ifNoneMatch && ifNoneMatch.includes(cached.etag)) {
    cacheStats.hits++;
    return { cache: cached, shouldRevalidate: false };
  }

  // Soft expiration (stale-while-revalidate)
  const shouldRevalidate = cached.softExpiresAt < now;
  cacheStats.hits++;

  return { cache: cached, shouldRevalidate };
}

/**
 * Store data in cache with adaptive TTL
 */
function setCachedData(cacheKey: string, data: DashboardData, isRevalidation: boolean = false): DashboardCache {
  const timestamp = Date.now();
  const etag = generateETag(data, timestamp);

  // Check if we're updating existing cache entry
  const existing = dashboardCache.get(cacheKey);
  const accessCount = existing?.accessCount || 0;
  const isHot = existing ? (existing.accessCount > 3 && (timestamp - existing.timestamp) < 30 * 60 * 1000) : false;

  const adaptiveTTL = calculateTTL(accessCount, isHot);

  const cacheEntry: DashboardCache = {
    data,
    etag,
    timestamp,
    expiresAt: timestamp + adaptiveTTL,
    softExpiresAt: timestamp + CACHE_CONFIG.SOFT_TTL,
    accessCount: isRevalidation ? accessCount : 1,
    lastAccessed: timestamp,
    dataVersion: currentDataVersion
  };

  dashboardCache.set(cacheKey, cacheEntry);

  console.log(`Cache ${isRevalidation ? 'revalidated' : 'set'} for key ${cacheKey}: TTL=${Math.round(adaptiveTTL/1000)}s, hot=${isHot}`);

  return cacheEntry;
}

/**
 * Invalidate cache when data changes
 */
export function invalidateDashboardCache(reason: string = 'manual') {
  currentDataVersion++;
  console.log(`Dashboard cache invalidated (version ${currentDataVersion}): ${reason}`);

  // Optional: Clear cache immediately for critical updates
  if (reason.includes('critical') || reason.includes('schema')) {
    dashboardCache.clear();
    console.log('Cache cleared immediately due to critical update');
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  const hitRate = cacheStats.totalRequests > 0 ? (cacheStats.hits / cacheStats.totalRequests) * 100 : 0;

  return {
    ...cacheStats,
    hitRate: Math.round(hitRate * 100) / 100,
    cacheSize: dashboardCache.size,
    memoryUsage: process.memoryUsage(),
    oldestEntry: Math.min(...Array.from(dashboardCache.values()).map(c => c.timestamp)),
    newestEntry: Math.max(...Array.from(dashboardCache.values()).map(c => c.timestamp))
  };
}

/**
 * ESPN Architecture Admin Dashboard API
 * GET /api/espn/admin/dashboard
 *
 * Provides comprehensive status information about the ESPN architecture refactor
 * Implements response caching with ETags to reduce database load
 */
export async function GET(request: NextRequest) {
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
        error: 'Access denied. Only league administrators can access the admin dashboard.'
      }, { status: 403 });
    }

    // Generate cache key for this user and their leagues
    const adminLeagueIds = adminLeagues.map(l => l.id);
    const cacheKey = generateCacheKey(user.id, adminLeagueIds);

    // Check for client-side caching (If-None-Match header)
    const ifNoneMatch = request.headers.get('if-none-match');

    // Try to get cached data with enhanced strategy
    const { cache: cached, shouldRevalidate } = getCachedData(cacheKey, ifNoneMatch || undefined);

    if (cached) {
      // Return 304 Not Modified if client has current version
      if (ifNoneMatch && ifNoneMatch.includes(cached.etag)) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            'ETag': cached.etag,
            'Cache-Control': `private, max-age=${Math.floor(CACHE_CONFIG.SOFT_TTL / 1000)}`,
            'X-Cache-Status': shouldRevalidate ? 'HIT-304-STALE' : 'HIT-304',
            'X-Cache-Access-Count': cached.accessCount.toString()
          }
        });
      }

      // For stale-while-revalidate: return cached data immediately but trigger background refresh
      if (shouldRevalidate) {
        console.log(`Serving stale data for ${cacheKey}, triggering background revalidation`);

        // Background revalidation (fire and forget)
        setImmediate(async () => {
          try {
            console.log(`Background revalidation started for ${cacheKey}`);
            const freshData = await fetchFreshDashboardData(adminLeagues);
            setCachedData(cacheKey, freshData, true);
            console.log(`Background revalidation completed for ${cacheKey}`);
          } catch (error) {
            console.error(`Background revalidation failed for ${cacheKey}:`, error);
          }
        });

        return NextResponse.json(cached.data, {
          headers: {
            'ETag': cached.etag,
            'Cache-Control': `private, max-age=${Math.floor(CACHE_CONFIG.SOFT_TTL / 1000)}`,
            'X-Cache-Status': 'HIT-STALE',
            'X-Cache-Age': Math.floor((Date.now() - cached.timestamp) / 1000).toString(),
            'X-Cache-Revalidating': 'true'
          }
        });
      }

      // Return fresh cached data
      return NextResponse.json(cached.data, {
        headers: {
          'ETag': cached.etag,
          'Cache-Control': `private, max-age=${Math.floor(CACHE_CONFIG.SOFT_TTL / 1000)}`,
          'X-Cache-Status': 'HIT',
          'X-Cache-Age': Math.floor((Date.now() - cached.timestamp) / 1000).toString(),
          'X-Cache-Access-Count': cached.accessCount.toString()
        }
      });
    }

    console.log(`ESPN admin dashboard: Cache miss for user ${user.id}, fetching fresh data`);

    // Fetch fresh data
    const freshData = await fetchFreshDashboardData(adminLeagues);

    // Update cache statistics
    const queryTime = freshData._metadata.queryTimeMs;
    cacheStats.averageQueryTime = cacheStats.averageQueryTime === 0
      ? queryTime
      : Math.round((cacheStats.averageQueryTime * 0.8) + (queryTime * 0.2)); // Exponential moving average

    // Add user info to response
    freshData.userInfo = {
      id: user.id,
      adminOfLeagues: adminLeagues.map(l => l.name),
    };

    // Cache the response
    const cacheEntry = setCachedData(cacheKey, freshData);

    return NextResponse.json(freshData, {
      headers: {
        'ETag': cacheEntry.etag,
        'Cache-Control': `private, max-age=${Math.floor(CACHE_CONFIG.SOFT_TTL / 1000)}`,
        'X-Cache-Status': 'MISS',
        'X-Query-Time': queryTime.toString(),
        'X-Cache-TTL': Math.round((cacheEntry.expiresAt - Date.now()) / 1000).toString()
      }
    });

  } catch (error) {
    console.error('ESPN admin dashboard failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to load admin dashboard',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store' // Don't cache errors
      }
    });
  }
}

/**
 * Fetch fresh dashboard data (extracted for reuse in background revalidation)
 */
async function fetchFreshDashboardData(_adminLeagues?: Array<{ id: number; name: string }>): Promise<DashboardData> {
  const startTime = Date.now();

  const [
    schemaStatus,
    dataStatus,
    matchingStats,
    espnApiStats,
    recentActivity
  ] = await Promise.all([
    getSchemaStatus(),
    getDataStatus(),
    getMatchingStatistics().catch(() => ({
      totalMappings: 0,
      sourceBreakdown: {},
      averageConfidence: 0,
      highConfidenceCount: 0,
    })),
    getESPNAPIStats(),
    getRecentActivity(),
  ]);

  const queryTime = Date.now() - startTime;
  console.log(`ESPN admin dashboard: Data fetched in ${queryTime}ms`);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    architecture: {
      status: 'ESPN Primary (Refactored)',
      version: '2.0',
      description: 'ESPN as authoritative source with odds attachment',
    },
    schemaStatus,
    dataStatus,
    matchingStats,
    espnApiStats,
    recentActivity,
    healthChecks: {
      schemaReady: schemaStatus.gamesTable.hasEspnGameId,
      dataIngested: dataStatus.totalGames > 0 && dataStatus.gamesWithEspnId > 0,
      oddsAttached: dataStatus.gamesWithOdds > 0,
      scoringWorking: espnApiStats.recentScoringCalls > 0,
    },
    nextSteps: generateNextSteps(schemaStatus, dataStatus, matchingStats),
    _metadata: {
      queryTimeMs: queryTime,
      cacheStatus: 'FRESH',
      cacheStats: getCacheStats(),
    }
  };
}

/**
 * Check database schema status
 */
async function getSchemaStatus() {
  // Check games table structure
  const { data: gamesStructure } = await supabaseAdmin
    .from('games')
    .select('*')
    .limit(1);

  const { data: teamsStructure } = await supabaseAdmin
    .from('teams')
    .select('*')
    .limit(1);

  // Check if odds source mapping table exists
  const { data: mappingTableExists } = await supabaseAdmin
    .from('odds_source_mapping')
    .select('id')
    .limit(1)
    .single();

  const sampleGame = gamesStructure?.[0];
  const sampleTeam = teamsStructure?.[0];

  return {
    gamesTable: {
      hasEspnGameId: sampleGame && 'espn_game_id' in sampleGame,
      hasEspnEventName: sampleGame && 'espn_event_name' in sampleGame,
      hasVenueName: sampleGame && 'venue_name' in sampleGame,
      hasWeek: sampleGame && 'week' in sampleGame,
    },
    teamsTable: {
      hasEspnTeamId: sampleTeam && 'espn_team_id' in sampleTeam,
    },
    mappingTable: {
      exists: !mappingTableExists || mappingTableExists.id !== undefined,
    },
  };
}

/**
 * Get data ingestion and coverage status
 */
async function getDataStatus() {
  const currentYear = new Date().getFullYear();
  const seasonName = `${currentYear} NFL Season`;

  // Games data
  const { data: totalGames } = await supabaseAdmin
    .from('games')
    .select('id, espn_game_id, week, status')
    .eq('seasons.name', seasonName);

  const { data: gamesWithEspnId } = await supabaseAdmin
    .from('games')
    .select('id')
    .not('espn_game_id', 'is', null);

  const { data: gamesWithOdds } = await supabaseAdmin
    .from('games')
    .select('id')
    .in('id',
      await supabaseAdmin
        .from('odds')
        .select('game_id')
        .then(({ data }) => data?.map(o => o.game_id) || [])
    );

  // Week distribution
  const weeklyDistribution: Record<number, number> = {};
  if (totalGames) {
    for (const game of totalGames) {
      if (game.week) {
        weeklyDistribution[game.week] = (weeklyDistribution[game.week] || 0) + 1;
      }
    }
  }

  return {
    totalGames: totalGames?.length || 0,
    gamesWithEspnId: gamesWithEspnId?.length || 0,
    gamesWithOdds: gamesWithOdds?.length || 0,
    espnIdCoverage: totalGames?.length
      ? Math.round((gamesWithEspnId?.length || 0) * 100 / totalGames.length)
      : 0,
    oddsCoverage: totalGames?.length
      ? Math.round((gamesWithOdds?.length || 0) * 100 / totalGames.length)
      : 0,
    weeklyDistribution,
  };
}

/**
 * Get ESPN API usage statistics
 */
async function getESPNAPIStats() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: recentCalls } = await supabaseAdmin
    .from('espn_api_calls')
    .select('*')
    .gte('called_at', oneDayAgo.toISOString())
    .order('called_at', { ascending: false });

  const { data: scoringCalls } = await supabaseAdmin
    .from('espn_api_calls')
    .select('id')
    .eq('ingestion_type', 'scoring')
    .gte('called_at', oneDayAgo.toISOString());

  const { data: ingestionCalls } = await supabaseAdmin
    .from('espn_api_calls')
    .select('id')
    .eq('ingestion_type', 'ingestion')
    .gte('called_at', oneDayAgo.toISOString());

  return {
    recentCalls: recentCalls?.length || 0,
    recentScoringCalls: scoringCalls?.length || 0,
    recentIngestionCalls: ingestionCalls?.length || 0,
    averageResponseTime: recentCalls?.length
      ? Math.round(recentCalls.reduce((sum, call) => sum + (call.response_time_ms || 0), 0) / recentCalls.length)
      : 0,
    lastCall: recentCalls?.[0]?.called_at,
    errorRate: recentCalls?.length
      ? Math.round((recentCalls.filter(call => call.status_code !== 200).length / recentCalls.length) * 100)
      : 0,
  };
}

/**
 * Get recent system activity
 */
async function getRecentActivity() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data: recentPicksActivity } = await supabaseAdmin
    .from('picks')
    .select('id, created_at, result')
    .gte('created_at', oneWeekAgo.toISOString());

  const { data: recentScoringEvents } = await supabaseAdmin
    .from('scoring_events')
    .select('id, processed_at, picks_processed, points_awarded')
    .gte('processed_at', oneWeekAgo.toISOString())
    .order('processed_at', { ascending: false })
    .limit(10);

  return {
    recentPicks: recentPicksActivity?.length || 0,
    recentScoringEvents: recentScoringEvents?.length || 0,
    recentPointsAwarded: recentScoringEvents?.reduce((sum, event) => sum + (event.points_awarded || 0), 0) || 0,
    lastScoringEvent: recentScoringEvents?.[0]?.processed_at,
  };
}

/**
 * Generate next steps recommendations
 */
function generateNextSteps(
  schemaStatus: Record<string, unknown>,
  dataStatus: Record<string, unknown>,
  matchingStats: Record<string, unknown>
): string[] {
  const steps: string[] = [];

  // Type-safe access to nested properties
  const gamesTable = schemaStatus.gamesTable as Record<string, unknown> | undefined;
  const hasEspnGameId = gamesTable?.hasEspnGameId as boolean | undefined;
  const totalGames = dataStatus.totalGames as number | undefined;
  const espnIdCoverage = dataStatus.espnIdCoverage as number | undefined;
  const gamesWithOdds = dataStatus.gamesWithOdds as number | undefined;
  const totalMappings = matchingStats.totalMappings as number | undefined;
  const averageConfidence = matchingStats.averageConfidence as number | undefined;

  if (!hasEspnGameId) {
    steps.push('Run schema migration: POST /api/espn/migrate-schema');
  }

  if ((totalGames || 0) === 0) {
    steps.push('Ingest ESPN season data: POST /api/espn/ingest-season');
  }

  if ((totalGames || 0) > 0 && (espnIdCoverage || 0) < 90) {
    steps.push('Re-run ESPN season ingestion to improve coverage');
  }

  if ((gamesWithOdds || 0) === 0) {
    steps.push('Sync odds with game matching: POST /api/sync-odds');
  }

  if ((totalMappings || 0) === 0 && (gamesWithOdds || 0) > 0) {
    steps.push('Check odds matching configuration');
  }

  if ((averageConfidence || 0) < 80) {
    steps.push('Review and improve game matching algorithm');
  }

  if (steps.length === 0) {
    steps.push('✅ Architecture is fully operational');
    steps.push('Monitor ESPN API calls and game matching quality');
    steps.push('Test automated scoring functionality');
  }

  return steps;
}
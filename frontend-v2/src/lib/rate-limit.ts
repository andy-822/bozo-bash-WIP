import { kv } from '@vercel/kv'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export async function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute default
): Promise<RateLimitResult> {
  // Skip rate limiting in development
  if (process.env.NODE_ENV !== 'production') {
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Date.now() + windowMs
    }
  }

  // Check if KV is configured for production
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn('Rate limiting disabled: KV environment variables not configured')
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Date.now() + windowMs
    }
  }

  const key = `rate_limit:${identifier}`
  const window = Math.floor(Date.now() / windowMs)
  const windowKey = `${key}:${window}`

  try {
    // Get current count for this window
    const current = await kv.get<number>(windowKey) || 0

    if (current >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: (window + 1) * windowMs
      }
    }

    // Increment counter
    const newCount = current + 1
    await kv.set(windowKey, newCount, { ex: Math.ceil(windowMs / 1000) })

    return {
      success: true,
      limit,
      remaining: limit - newCount,
      reset: (window + 1) * windowMs
    }
  } catch (error) {
    console.error('Rate limiting error:', error)
    // On error, allow the request but log it
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: (window + 1) * windowMs
    }
  }
}

// Specific rate limiters for different endpoints with detailed rationale

export async function rateLimitOddsSync(ip: string): Promise<RateLimitResult> {
  /**
   * ODDS SYNC RATE LIMITING: 5 calls per minute
   *
   * Rationale:
   * - Makes 18 sequential ESPN API calls (weeks 1-18) + odds API calls
   * - Each full sync takes ~15-20 seconds due to 500ms delays between requests
   * - The Odds API has usage limits and costs money per request
   * - Prevents abuse while allowing legitimate automated CRON jobs
   * - 5 calls/minute allows recovery from transient failures without overwhelming external APIs
   *
   * Risk mitigation:
   * - Protects against expensive external API quota exhaustion
   * - Prevents ESPN API rate limiting (unofficial rate limits unknown)
   * - Reduces infrastructure costs from excessive third-party API usage
   */
  return rateLimit(`odds_sync:${ip}`, 5, 60000) // 5 calls per minute
}

export async function rateLimitScoringAuto(ip: string): Promise<RateLimitResult> {
  /**
   * AUTOMATED SCORING RATE LIMITING: 10 calls per minute
   *
   * Rationale:
   * - Processes game results and calculates user scores
   * - Involves multiple database queries and potential updates
   * - Should run frequently during game days but not be spammed
   * - Moderate limit allows both automated systems and manual triggers
   * - Higher than odds sync since it's database-only (no external API costs)
   */
  return rateLimit(`scoring_auto:${ip}`, 10, 60000) // 10 calls per minute
}

export async function rateLimitGeneral(ip: string): Promise<RateLimitResult> {
  /**
   * GENERAL API RATE LIMITING: 100 calls per minute
   *
   * Rationale:
   * - Covers standard CRUD operations (leagues, seasons, picks, etc.)
   * - Allows normal user interactions and bulk operations
   * - Prevents basic abuse and DOS attacks
   * - High enough to not interfere with legitimate usage patterns
   * - Can handle multiple users and automated clients simultaneously
   */
  return rateLimit(`general:${ip}`, 100, 60000) // 100 calls per minute
}

export async function rateLimitESPNIngest(ip: string): Promise<RateLimitResult> {
  /**
   * ESPN SEASON INGESTION RATE LIMITING: 2 calls per 5 minutes
   *
   * Rationale:
   * - MOST EXPENSIVE OPERATION: Fetches complete 18-week NFL season (272+ games)
   * - Makes 18 sequential ESPN API calls with 500ms delays (15+ seconds total)
   * - Creates/updates 32 teams + 272 games + venue data in database
   * - Should only run during season setup or major data refreshes
   * - Very restrictive to prevent accidental resource exhaustion
   *
   * Why 2 calls per 5 minutes:
   * - Allows retry if first attempt fails due to network issues
   * - Prevents rapid-fire executions that could overwhelm ESPN's servers
   * - 5-minute window accounts for the operation's ~20-second duration
   * - Balances system protection with operational flexibility for admins
   *
   * Risk mitigation:
   * - Prevents ESPN API abuse (unofficial API, rate limiting unknown)
   * - Reduces database load from bulk operations
   * - Prevents accidental duplicate season ingestion
   * - Protects against malicious bulk data manipulation
   */
  return rateLimit(`espn_ingest:${ip}`, 2, 300000) // 2 calls per 5 minutes
}

export async function rateLimitESPNMigration(ip: string): Promise<RateLimitResult> {
  /**
   * ESPN SCHEMA MIGRATION RATE LIMITING: 3 calls per 10 minutes
   *
   * Rationale:
   * - CRITICAL INFRASTRUCTURE OPERATION: Database schema validation/migration
   * - Checks table structure, indexes, and data integrity
   * - Should only be run during deployments or major system changes
   * - Extremely sensitive operation that could affect system stability
   *
   * Why 3 calls per 10 minutes:
   * - Allows initial execution + 2 retries for deployment scenarios
   * - 10-minute window prevents rapid schema validation loops
   * - Higher count than season ingestion due to read-only nature (safer)
   * - Accommodates CI/CD pipelines that might need multiple checks
   *
   * Risk mitigation:
   * - Prevents excessive database introspection queries
   * - Reduces risk of migration-related system instability
   * - Protects against malicious schema probing
   * - Ensures migrations are deliberate, not accidental
   */
  return rateLimit(`espn_migration:${ip}`, 3, 600000) // 3 calls per 10 minutes
}
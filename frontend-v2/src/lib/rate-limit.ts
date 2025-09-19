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

// Specific rate limiters for different endpoints
export async function rateLimitOddsSync(ip: string): Promise<RateLimitResult> {
  // Very restrictive for expensive external API calls
  return rateLimit(`odds_sync:${ip}`, 5, 60000) // 5 calls per minute
}

export async function rateLimitScoringAuto(ip: string): Promise<RateLimitResult> {
  // Moderate limits for scoring endpoint
  return rateLimit(`scoring_auto:${ip}`, 10, 60000) // 10 calls per minute
}

export async function rateLimitGeneral(ip: string): Promise<RateLimitResult> {
  // General API rate limiting
  return rateLimit(`general:${ip}`, 100, 60000) // 100 calls per minute
}
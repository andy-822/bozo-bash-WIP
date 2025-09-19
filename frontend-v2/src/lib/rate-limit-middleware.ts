import { NextRequest, NextResponse } from 'next/server';
import { rateLimitGeneral } from './rate-limit';

export async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimitGeneral(ip);

    if (!rateLimitResult.success) {
        return NextResponse.json({
            error: 'Too many requests',
            message: 'Rate limit exceeded',
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

    return null; // No rate limit hit
}
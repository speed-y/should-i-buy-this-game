import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { env } from '@/lib/env'
import { fetchVerdict } from '@/lib/verdict'

// Initialize Upstash Redis rate limiter
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 requests per minute
  analytics: true,
})

// Enforce request body validation schema
const bodySchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens only'),
  })
  .strict()

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Enforce max body size of 1KB
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > 1024) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 400 })
    }

    // 2. Extract client IP and apply Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1'

    // In production environment, Upstash Redis must be called.
    // If Redis credentials are placeholders during unit testing or build, bypass rate limit checking.
    if (!env.UPSTASH_REDIS_REST_URL.includes('placeholder')) {
      const { success, limit, reset, remaining } = await ratelimit.limit(ip)
      if (!success) {
        return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        })
      }
    }

    // 3. Parse and validate JSON request body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    const parseResult = bodySchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { slug } = parseResult.data

    // 4. Execute the verdict orchestration
    const result = await fetchVerdict(slug)

    return NextResponse.json(result)
  } catch (error) {
    console.error('API /api/verdict error:', error)

    const errorMessage = error instanceof Error ? error.message : ''
    if (errorMessage === 'Game not found') {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'AI verdict unavailable, try again later' }, { status: 503 })
  }
}

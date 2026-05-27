import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the env module directly to ensure non-placeholder values during rate-limiting testing
vi.mock('@/lib/env', () => {
  return {
    env: {
      RAWG_API_KEY: 'test_rawg_key',
      GEMINI_API_KEY: 'test_gemini_key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-supabase.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test_anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test_service',
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test_token',
    },
  }
})

import { POST } from '@/app/api/verdict/route'
import { NextRequest } from 'next/server'

// Mock Upstash redis
vi.mock('@upstash/redis', () => {
  return {
    Redis: class {},
  }
})

// Mock the verdict orchestrator to avoid live fetching
vi.mock('@/lib/verdict', () => {
  return {
    fetchVerdict: vi.fn().mockResolvedValue({
      gameName: 'Elden Ring',
      verdict: 'buy',
      reasons: ['Reason A', 'Reason B', 'Reason C'],
      price: {
        current: 59.99,
        historicalLow: 49.99,
        currency: 'USD',
        store: 'Steam',
      },
      affiliateUrl: 'https://store.steampowered.com/search/?term=Elden%20Ring',
      cached: false,
    }),
  }
})

// Setup a dynamic mock for Ratelimit limit function
let currentRateLimitSuccess = true
let limitCallCount = 0
const ipCalls = new Map<string, number>()

vi.mock('@upstash/ratelimit', () => {
  return {
    Ratelimit: class {
      limit(ip: string) {
        limitCallCount++
        const count = (ipCalls.get(ip) || 0) + 1
        ipCalls.set(ip, count)

        // Simulate rate-limiting success or failure based on test config or per-IP count
        if (!currentRateLimitSuccess || count > 10) {
          return { success: false, limit: 10, reset: 60, remaining: 0 }
        }
        return { success: true, limit: 10, reset: 0, remaining: 10 - count }
      }
      static slidingWindow() {}
    },
  }
})

describe('Security: Upstash Redis Rate Limiting Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRateLimitSuccess = true
    limitCallCount = 0
    ipCalls.clear()
  })

  const makeRequest = (ip: string) => {
    return new NextRequest('http://localhost:3000/api/verdict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ slug: 'elden-ring' }),
    })
  }

  it('should allow request to proceed if under the rate limit', async () => {
    currentRateLimitSuccess = true

    const response = await POST(makeRequest('192.168.1.1'))

    // It calls the rate limiter and returns 200 (since it bypasses rate limit placeholder checking)
    expect(limitCallCount).toBe(1)
    expect(response.status).not.toBe(429)
  })

  it('should return 429 Too Many Requests when rate limit is exceeded', async () => {
    currentRateLimitSuccess = false // Simulate exceeding limits

    const response = await POST(makeRequest('192.168.1.1'))

    expect(limitCallCount).toBe(1)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')

    const json = await response.json()
    expect(json.error).toBe('Too Many Requests')
  })

  it("should ensure different IPs are not affected by each other's limits", async () => {
    const ipA = '1.1.1.1'
    const ipB = '2.2.2.2'

    // 1. IP A makes 10 successful requests to reach its limit
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest(ipA))
      expect(response.status).not.toBe(429)
    }

    // 2. IP A makes the 11th request and gets rate-limited (429)
    const responseBlocked = await POST(makeRequest(ipA))
    expect(responseBlocked.status).toBe(429)

    // 3. IP B makes a request and it successfully passes (not affected by IP A's limit)
    const responseB = await POST(makeRequest(ipB))
    expect(responseB.status).not.toBe(429)
  })
})

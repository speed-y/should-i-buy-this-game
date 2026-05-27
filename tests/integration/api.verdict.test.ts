import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/verdict/route'
import { NextRequest } from 'next/server'
import * as orchestratorModule from '@/lib/verdict'

vi.mock('@/lib/verdict')
vi.mock('@upstash/ratelimit', () => {
  return {
    Ratelimit: class {
      limit() {
        return { success: true, limit: 10, reset: 0, remaining: 9 }
      }
      static slidingWindow() {}
    },
  }
})
vi.mock('@upstash/redis', () => {
  return {
    Redis: class {},
  }
})

describe('/api/verdict Integration API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost:3000/api/verdict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  it('should return 200 and correct payload on valid slug request', async () => {
    const mockVerdict = {
      gameName: 'Elden Ring',
      verdict: 'buy' as const,
      reasons: ['Reason A', 'Reason B', 'Reason C'],
      price: {
        current: 39.99,
        historicalLow: 29.99,
        currency: 'USD',
        store: 'Steam',
      },
      affiliateUrl: 'https://store.steampowered.com/search/?term=Elden%20Ring',
      cached: true,
    }

    vi.spyOn(orchestratorModule, 'fetchVerdict').mockResolvedValue(mockVerdict)

    const request = makeRequest({ slug: 'elden-ring' })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.gameName).toBe('Elden Ring')
    expect(json.verdict).toBe('buy')
  })

  it('should return 400 Bad Request on invalid slug layout format', async () => {
    const request = makeRequest({ slug: 'elden_ring_INVALID_FORMAT_123!' })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Bad Request')
  })

  it('should return 404 on Game not found', async () => {
    vi.spyOn(orchestratorModule, 'fetchVerdict').mockRejectedValue(new Error('Game not found'))

    const request = makeRequest({ slug: 'missing-game' })
    const response = await POST(request)

    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error).toBe('Game not found')
  })

  it('should return 503 on general AI / DB / API crash failures', async () => {
    vi.spyOn(orchestratorModule, 'fetchVerdict').mockRejectedValue(new Error('Gemini API is down'))

    const request = makeRequest({ slug: 'elden-ring' })
    const response = await POST(request)

    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error).toBe('AI verdict unavailable, try again later')
  })
})

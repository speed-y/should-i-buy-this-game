import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/verdict/route'
import { NextRequest } from 'next/server'

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

describe('Security: Input Validation & Sanitization Tests', () => {
  const makeRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost:3000/api/verdict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  it('should reject slugs attempting path traversal (e.g., ../../etc/passwd) with 400', async () => {
    const response = await POST(makeRequest({ slug: '../../etc/passwd' }))
    expect(response.status).toBe(400)
  })

  it('should reject slugs containing SQL Injection markers with 400', async () => {
    const response = await POST(makeRequest({ slug: "'; DROP TABLE verdicts;--" }))
    expect(response.status).toBe(400)
  })

  it('should reject oversized slugs (> 100 characters) with 400', async () => {
    const hugeSlug = 'a'.repeat(101)
    const response = await POST(makeRequest({ slug: hugeSlug }))
    expect(response.status).toBe(400)
  })

  it('should reject requests with missing slugs with 400', async () => {
    const response = await POST(makeRequest({}))
    expect(response.status).toBe(400)
  })

  it('should reject non-string slugs with 400', async () => {
    const response = await POST(makeRequest({ slug: 12345 }))
    expect(response.status).toBe(400)
  })

  it('should reject requests containing unexpected extra fields with 400 (strict validation)', async () => {
    const response = await POST(
      makeRequest({
        slug: 'elden-ring',
        hack: 'unexpected-payload-injection',
      })
    )
    expect(response.status).toBe(400)
  })
})

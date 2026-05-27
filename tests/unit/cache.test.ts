import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCachedVerdict, upsertCachedVerdict } from '@/lib/cache'
import { supabaseAdmin } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => {
  const selectMock = vi.fn()
  const eqMock = vi.fn().mockImplementation(() => ({
    single: selectMock,
  }))
  const selectQueryMock = vi.fn().mockImplementation(() => ({
    eq: eqMock,
  }))

  const upsertMock = vi.fn().mockResolvedValue({ error: null })

  const fakeClient = {
    from: vi.fn().mockImplementation((table) => {
      if (table === 'verdicts') {
        return {
          select: selectQueryMock,
          upsert: upsertMock,
        }
      }
      return {}
    }),
  }

  return {
    supabaseAdmin: vi.fn().mockReturnValue(fakeClient),
    supabaseClient: vi.fn(),
  }
})

describe('Supabase Caching Engine', () => {
  const mockClient = supabaseAdmin()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null on cache miss', async () => {
    const singleMock = mockClient.from('verdicts').select().eq('game_slug', '').single as any
    singleMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No row found' },
    })

    const result = await getCachedVerdict('missing-game')
    expect(result).toBeNull()
  })

  it('should return cached result if it is fresh (< 7 days old)', async () => {
    const singleMock = mockClient.from('verdicts').select().eq('game_slug', '').single as any
    singleMock.mockResolvedValue({
      data: {
        game_slug: 'elden-ring',
        game_name: 'Elden Ring',
        verdict: 'buy',
        reasons: ['Reason 1', 'Reason 2', 'Reason 3'],
        metacritic_score: 96,
        current_price: 39.99,
        historical_low: 29.99,
        ai_model: 'gemini-3.5-flash',
        updated_at: new Date().toISOString(),
      },
      error: null,
    })

    const result = await getCachedVerdict('elden-ring')
    expect(result).not.toBeNull()
    expect(result?.game_slug).toBe('elden-ring')
    expect(result?.verdict).toBe('buy')
  })

  it('should return null if cached result is stale (> 7 days old)', async () => {
    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 8)

    const singleMock = mockClient.from('verdicts').select().eq('game_slug', '').single as any
    singleMock.mockResolvedValue({
      data: {
        game_slug: 'elden-ring',
        game_name: 'Elden Ring',
        verdict: 'buy',
        reasons: ['Reason 1', 'Reason 2', 'Reason 3'],
        updated_at: staleDate.toISOString(),
      },
      error: null,
    })

    const result = await getCachedVerdict('elden-ring')
    expect(result).toBeNull()
  })

  it('should successfully upsert new cache record', async () => {
    const upsertMock = mockClient.from('verdicts').upsert as any
    await upsertCachedVerdict(
      'elden-ring',
      'Elden Ring',
      'buy',
      ['Reason 1', 'Reason 2', 'Reason 3'],
      96,
      undefined,
      39.99,
      29.99
    )
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        game_slug: 'elden-ring',
        game_name: 'Elden Ring',
        verdict: 'buy',
      }),
      expect.objectContaining({ onConflict: 'game_slug' })
    )
  })
})

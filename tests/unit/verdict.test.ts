import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchVerdict } from '@/lib/verdict'
import * as cacheModule from '@/lib/cache'
import * as rawgModule from '@/lib/rawg'
import * as pricingModule from '@/lib/pricing'
import * as geminiModule from '@/lib/ai'

// Mock modules
vi.mock('@/lib/cache')
vi.mock('@/lib/rawg')
vi.mock('@/lib/pricing')
vi.mock('@/lib/ai')

describe('Verdict Orchestrator Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: enrichment returns nothing — individual tests can override
    vi.spyOn(geminiModule, 'fetchWebEnrichment').mockResolvedValue({
      metacriticScore: null,
      sentiment: null,
    })
  })

  it('should return cached result directly on cache hit', async () => {
    const mockCached = {
      id: 'uuid-1',
      game_slug: 'elden-ring',
      game_name: 'Elden Ring',
      verdict: 'buy' as const,
      reasons: ['Reason 1', 'Reason 2', 'Reason 3'],
      metacritic_score: 96,
      current_price: 39.99,
      historical_low: 29.99,
      currency: 'USD',
      ai_model: 'gemini-3.5-flash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    vi.spyOn(cacheModule, 'getCachedVerdict').mockResolvedValue(mockCached)

    // Pricing is still fetched fresh
    const mockPrice = {
      current: 35.99,
      historicalLow: 29.99,
      currency: 'USD',
      store: 'Steam',
    }
    vi.spyOn(pricingModule, 'getGamePrice').mockResolvedValue(mockPrice)

    const result = await fetchVerdict('elden-ring')

    expect(cacheModule.getCachedVerdict).toHaveBeenCalledWith('elden-ring')
    expect(pricingModule.getGamePrice).toHaveBeenCalledWith('Elden Ring')

    // Ensure AI and RAWG are NOT called
    expect(rawgModule.getGameDetails).not.toHaveBeenCalled()
    expect(geminiModule.getVerdictFromAI).not.toHaveBeenCalled()

    expect(result.gameName).toBe('Elden Ring')
    expect(result.verdict).toBe('buy')
    expect(result.cached).toBe(true)
    expect(result.price?.current).toBe(35.99)
  })

  it('should call APIs and save in cache on cache miss', async () => {
    vi.spyOn(cacheModule, 'getCachedVerdict').mockResolvedValue(null)

    const mockDetails = {
      slug: 'cyberpunk-2077',
      name: 'Cyberpunk 2077',
      description: 'A sci-fi RPG',
      metacritic: 86,
    }
    vi.spyOn(rawgModule, 'getGameDetails').mockResolvedValue(mockDetails)

    const mockPrice = {
      current: 29.99,
      historicalLow: 19.99,
      currency: 'USD',
      store: 'Epic Games Store',
    }
    vi.spyOn(pricingModule, 'getGamePrice').mockResolvedValue(mockPrice)

    const mockVerdict = {
      gameName: 'Cyberpunk 2077',
      verdict: 'wait' as const,
      reasons: ['Reason A', 'Reason B', 'Reason C'],
    }
    vi.spyOn(geminiModule, 'getVerdictFromAI').mockResolvedValue(mockVerdict)

    const result = await fetchVerdict('cyberpunk-2077')

    expect(cacheModule.getCachedVerdict).toHaveBeenCalledWith('cyberpunk-2077')
    expect(rawgModule.getGameDetails).toHaveBeenCalledWith('cyberpunk-2077')
    expect(pricingModule.getGamePrice).toHaveBeenCalledWith('Cyberpunk 2077')
    expect(geminiModule.getVerdictFromAI).toHaveBeenCalledWith(mockDetails, mockPrice, null)

    // Ensure it was saved in cache
    expect(cacheModule.upsertCachedVerdict).toHaveBeenCalledWith(
      'cyberpunk-2077',
      'Cyberpunk 2077',
      'wait',
      ['Reason A', 'Reason B', 'Reason C'],
      86,
      undefined, // userRating — not set in mockDetails
      29.99,
      19.99
    )

    expect(result.gameName).toBe('Cyberpunk 2077')
    expect(result.verdict).toBe('wait')
    expect(result.cached).toBe(false)
  })

  it('falls back to cached pricing when live price fetch fails', async () => {
    const mockCached = {
      id: 'uuid-2',
      game_slug: 'portal-2',
      game_name: 'Portal 2',
      verdict: 'buy' as const,
      reasons: ['R1', 'R2', 'R3'],
      metacritic_score: 95,
      current_price: 0.99,
      historical_low: 0.49,
      currency: 'USD',
      ai_model: 'gemini-3.5-flash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    vi.spyOn(cacheModule, 'getCachedVerdict').mockResolvedValue(mockCached)
    vi.spyOn(pricingModule, 'getGamePrice').mockRejectedValue(new Error('ITAD timeout'))

    const result = await fetchVerdict('portal-2')

    expect(result.cached).toBe(true)
    expect(result.price?.current).toBe(0.99)
    expect(result.price?.historicalLow).toBe(0.49)
    // RAWG and AI must not be called on a cache hit
    expect(rawgModule.getGameDetails).not.toHaveBeenCalled()
    expect(geminiModule.getVerdictFromAI).not.toHaveBeenCalled()
  })

  it('backfills metacritic from web enrichment when RAWG has none', async () => {
    vi.spyOn(cacheModule, 'getCachedVerdict').mockResolvedValue(null)

    const mockDetails = {
      slug: 'hades',
      name: 'Hades',
      description: 'A rogue-like dungeon crawler',
    }
    vi.spyOn(rawgModule, 'getGameDetails').mockResolvedValue(mockDetails)
    vi.spyOn(pricingModule, 'getGamePrice').mockResolvedValue({
      current: 19.99,
      historicalLow: 9.99,
      currency: 'USD',
      store: 'Steam',
    })
    vi.spyOn(geminiModule, 'fetchWebEnrichment').mockResolvedValue({
      metacriticScore: 93,
      sentiment: null,
    })
    vi.spyOn(geminiModule, 'getVerdictFromAI').mockResolvedValue({
      gameName: 'Hades',
      verdict: 'buy' as const,
      reasons: ['A', 'B', 'C'],
    })

    await fetchVerdict('hades')

    const calledWithGame = (geminiModule.getVerdictFromAI as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(calledWithGame.metacritic).toBe(93)
  })

  it('passes enrichment sentiment to the AI verdict call', async () => {
    vi.spyOn(cacheModule, 'getCachedVerdict').mockResolvedValue(null)

    vi.spyOn(rawgModule, 'getGameDetails').mockResolvedValue({
      slug: 'hades',
      name: 'Hades',
      description: 'A rogue-like dungeon crawler',
      metacritic: 93,
    })
    vi.spyOn(pricingModule, 'getGamePrice').mockResolvedValue({
      current: 19.99,
      historicalLow: 9.99,
      currency: 'USD',
      store: 'Steam',
    })
    vi.spyOn(geminiModule, 'fetchWebEnrichment').mockResolvedValue({
      metacriticScore: null,
      sentiment: 'Fans love the deep combat and strong narrative.',
    })
    vi.spyOn(geminiModule, 'getVerdictFromAI').mockResolvedValue({
      gameName: 'Hades',
      verdict: 'buy' as const,
      reasons: ['A', 'B', 'C'],
    })

    await fetchVerdict('hades')

    expect(geminiModule.getVerdictFromAI).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'Fans love the deep combat and strong narrative.'
    )
  })
})

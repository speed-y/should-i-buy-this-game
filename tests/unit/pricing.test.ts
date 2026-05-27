import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGamePrice } from '@/lib/pricing'

// Mock global fetch and Redis
const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null), // always cache miss
    set: vi.fn().mockResolvedValue('OK'),
  })),
}))

vi.mock('@/lib/env', () => ({
  env: {
    UPSTASH_REDIS_REST_URL: 'https://fake-redis.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'fake-token',
    ITAD_API_KEY: 'fake-itad-key',
  },
}))

const MOCK_SEARCH_RESULT = [
  { id: 'itad-uuid-elden', slug: 'elden-ring', title: 'Elden Ring', type: 'game' },
]

const MOCK_PRICES_RESULT = [
  {
    id: 'itad-uuid-elden',
    deals: [
      {
        shop: { id: 20, name: 'GameBillet' },
        price: { amount: 29.95, currency: 'USD' },
        regular: { amount: 59.99, currency: 'USD' },
        cut: 50,
        voucher: null,
        storeLow: { amount: 29.95, currency: 'USD' },
        expiry: null,
        url: 'https://itad.link/fake-deal-1/',
      },
      {
        shop: { id: 6, name: 'Fanatical' },
        price: { amount: 35.99, currency: 'USD' },
        regular: { amount: 59.99, currency: 'USD' },
        cut: 40,
        voucher: null,
        storeLow: { amount: 31.79, currency: 'USD' },
        expiry: '2026-12-31T00:00:00Z',
        url: 'https://itad.link/fake-deal-2/',
      },
    ],
  },
]

const MOCK_HISTORY_LOW_RESULT = [
  {
    id: 'itad-uuid-elden',
    low: {
      shop: { id: 20, name: 'GameBillet' },
      price: { amount: 29.95, currency: 'USD' },
      cut: 50,
      timestamp: '2025-07-01T08:40:28+02:00',
    },
  },
]

describe('ITAD Pricing Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null if title is empty', async () => {
    const result = await getGamePrice('')
    expect(result).toBeNull()
  })

  it('should resolve game price from ITAD successfully', async () => {
    // 1. search, 2. prices, 3. historylow
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_SEARCH_RESULT })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_PRICES_RESULT })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_HISTORY_LOW_RESULT })

    const result = await getGamePrice('Elden Ring')

    expect(result).not.toBeNull()
    expect(result?.current).toBe(29.95) // cheapest deal
    expect(result?.historicalLow).toBe(29.95) // from historylow endpoint
    expect(result?.store).toBe('GameBillet')
    expect(result?.msrp).toBe(59.99)
    expect(result?.discountPercent).toBe(50)
    expect(result?.storePrices).toHaveLength(2)
    expect(result?.storePrices?.[0].store).toBe('GameBillet')
    expect(result?.storePrices?.[0].dealUrl).toBe('https://itad.link/fake-deal-1/')
  })

  it('should return null when no deals are found', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_SEARCH_RESULT })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'itad-uuid-elden', deals: [] }] })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_HISTORY_LOW_RESULT })

    const result = await getGamePrice('Unknown Game')
    expect(result).toBeNull()
  })

  it('should return null when game search finds nothing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] })

    const result = await getGamePrice('zzzznotarealegame')
    expect(result).toBeNull()
  })

  it('should return null gracefully when ITAD returns a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })

    const result = await getGamePrice('Portal 2')
    expect(result).toBeNull()
  })

  it('should fall back to current price as historical low when history endpoint fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_SEARCH_RESULT })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_PRICES_RESULT })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })

    const result = await getGamePrice('Elden Ring')

    expect(result).not.toBeNull()
    // Falls back to current price when history is unavailable
    expect(result?.historicalLow).toBe(result?.current)
  })
})

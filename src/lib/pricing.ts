/**
 * Pricing via IsThereAnyDeal (ITAD) API
 *
 * Flow:
 *   1. Redis cache check (1-hour TTL) — avoids hitting ITAD on every request
 *   2. ITAD game search by title → get canonical game ID
 *   3. ITAD prices/v3 → live multi-store deal prices with affiliate URLs
 *   4. ITAD historylow/v1 → all-time historical low price
 *   5. Assemble PriceData and cache in Redis
 */

import { Redis } from '@upstash/redis'
import { PriceData, StorePrice } from '../types'
import { env } from './env'

const ITAD_BASE = 'https://api.isthereanydeal.com'
const PRICE_CACHE_TTL = 60 * 60 // 1 hour in seconds

// ── Redis ──────────────────────────────────────────────────────────────────────

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    // @ts-expect-error - 'fetch' property is supported at runtime but missing from specific Node.js type definitions
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const cleanInit = init ? { ...init } : {}
        if (cleanInit.cache === 'no-store') {
          delete cleanInit.cache
        }
        return fetch(input, cleanInit)
      },
    })
  }
  return _redis
}

function priceCacheKey(title: string): string {
  return `price:itad:${title.toLowerCase().replace(/\s+/g, '-')}`
}

// ── ITAD types ─────────────────────────────────────────────────────────────────

interface ItadSearchResult {
  id: string
  slug: string
  title: string
  type: string
}

interface ItadDeal {
  shop: { id: number; name: string }
  price: { amount: number; currency: string }
  regular: { amount: number; currency: string }
  cut: number
  voucher: string | null
  storeLow: { amount: number; currency: string } | null
  expiry: string | null
  url: string
}

interface ItadPricesResponse {
  id: string
  deals: ItadDeal[]
}

interface ItadHistoryLowResponse {
  id: string
  low: {
    shop: { id: number; name: string }
    price: { amount: number; currency: string }
    cut: number
    timestamp: string
  } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function itadFetch<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const url = `${ITAD_BASE}${path}${path.includes('?') ? '&' : '?'}key=${env.ITAD_API_KEY}&country=US`
    const opts: RequestInit = body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : { method: 'GET' }
    const res = await fetch(url, opts)
    if (!res.ok) {
      console.error(`[ITAD] ${path} failed: ${res.status} ${res.statusText}`)
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.error(`[ITAD] fetch error for ${path}:`, e)
    return null
  }
}

/** Find the canonical ITAD game ID for a title, preferring exact type=game matches */
async function findItadGameId(title: string): Promise<string | null> {
  const results = await itadFetch<ItadSearchResult[]>(
    `/games/search/v1?title=${encodeURIComponent(title)}&results=5`
  )
  if (!results || results.length === 0) return null

  // Prefer exact title match of type 'game', then any exact match, then first game, then first result
  const exactGame = results.find(
    (r) => r.title.toLowerCase() === title.toLowerCase() && r.type === 'game'
  )
  const exactAny = results.find((r) => r.title.toLowerCase() === title.toLowerCase())
  const firstGame = results.find((r) => r.type === 'game')
  const match = exactGame ?? exactAny ?? firstGame ?? results[0]

  // eslint-disable-next-line no-console
  console.log(`[ITAD] Matched "${title}" → "${match.title}" (${match.id})`)
  return match.id
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function getGamePrice(title: string): Promise<PriceData | null> {
  if (!title) return null

  const cacheKey = priceCacheKey(title)

  // 0. Redis cache (1-hour TTL)
  try {
    const cached = await getRedis().get<PriceData>(cacheKey)
    if (cached) {
      // eslint-disable-next-line no-console
      console.log(`[ITAD] Redis cache HIT for "${title}"`)
      return cached
    }
  } catch (e) {
    console.warn('[ITAD] Redis cache read failed:', e)
  }

  // 1. Resolve ITAD game ID
  const gameId = await findItadGameId(title)
  if (!gameId) {
    console.warn(`[ITAD] No game found for "${title}"`)
    return null
  }

  // 2. Fetch live prices + historical low in parallel
  const [pricesData, historyData] = await Promise.all([
    itadFetch<ItadPricesResponse[]>('/games/prices/v3', [gameId]),
    itadFetch<ItadHistoryLowResponse[]>('/games/historylow/v1', [gameId]),
  ])

  const deals = pricesData?.[0]?.deals ?? []
  if (deals.length === 0) {
    console.warn(`[ITAD] No deals found for game ID ${gameId}`)
    return null
  }

  // Sort deals cheapest first
  const sorted = [...deals].sort((a, b) => a.price.amount - b.price.amount)
  const bestDeal = sorted[0]

  const currentPrice = bestDeal.price.amount
  const msrp = bestDeal.regular.amount
  const discountPercent = bestDeal.cut

  // Historical all-time low (across all stores)
  const historicalLow = historyData?.[0]?.low?.price.amount ?? currentPrice

  // Build store price comparison list (top 5 cheapest, with ITAD affiliate URLs)
  const storePrices: StorePrice[] = sorted.slice(0, 5).map((d) => ({
    store: d.shop.name,
    price: d.price.amount,
    regular: d.regular.amount,
    cut: d.cut,
    dealUrl: d.url, // ITAD affiliate link
    storeLow: d.storeLow?.amount,
    expiry: d.expiry ?? undefined,
  }))

  const priceData: PriceData = {
    current: currentPrice,
    historicalLow,
    currency: 'USD',
    store: bestDeal.shop.name,
    dealId: gameId,
    storePrices,
    msrp,
    discountPercent,
    dealUrl: bestDeal.url, // Best deal affiliate link
  }

  // 3. Cache in Redis for 1 hour
  try {
    await getRedis().set(cacheKey, priceData, { ex: PRICE_CACHE_TTL })
    // eslint-disable-next-line no-console
    console.log(
      `[ITAD] Cached "${title}" — best: ${bestDeal.shop.name} $${currentPrice} (${discountPercent}% off), ` +
        `all-time low: $${historicalLow}, ${storePrices.length} stores`
    )
  } catch (e) {
    console.warn('[ITAD] Redis cache write failed:', e)
  }

  return priceData
}

import { getCachedVerdict, upsertCachedVerdict } from './cache'
import { getGameDetails } from './rawg'
import { getGamePrice } from './pricing'
import { getVerdictFromAI, fetchWebEnrichment } from './ai'
import { VerdictResult, PriceData } from '../types'
import { env } from './env'

const AFFILIATE_BASE_URLS: Record<string, string> = {
  fanatical: 'https://www.fanatical.com/en/game/',
  humble: 'https://www.humblebundle.com/store/',
  gmg: 'https://www.greenmangaming.com/games/',
}

function getStoreKey(storeName: string): string | null {
  const normalized = storeName.toLowerCase()
  if (normalized.includes('fanatical')) return 'fanatical'
  if (normalized.includes('humble')) return 'humble'
  if (normalized.includes('green') || normalized.includes('gmg')) return 'gmg'
  return null
}

export function buildAffiliateUrl(storeName: string, gameSlug: string): string {
  const storeKey = getStoreKey(storeName)
  if (!storeKey) {
    throw new Error(`Unknown or non-affiliate store: ${storeName}`)
  }
  const base = AFFILIATE_BASE_URLS[storeKey]
  if (!base) {
    throw new Error(`Unknown base URL for store: ${storeKey}`)
  }
  return `${base}${encodeURIComponent(gameSlug)}`
}

export function validateAffiliateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const allowedHosts = [
      'www.fanatical.com',
      'fanatical.com',
      'www.humblebundle.com',
      'humblebundle.com',
      'www.greenmangaming.com',
      'greenmangaming.com',
    ]
    return allowedHosts.includes(parsed.host)
  } catch {
    return false
  }
}

function getMockVerdict(slug: string): VerdictResult | null {
  const s = slug.toLowerCase()
  if (s === 'elden-ring') {
    return {
      gameName: 'Elden Ring',
      verdict: 'buy',
      reasons: [
        '96 Metacritic score — universally acclaimed masterpiece with stellar open-world combat.',
        'Current price matches the absolute all-time lowest historical low deal on Steam.',
        'Delivers 100+ hours of highly polished, incredibly deep action-RPG gameplay value.',
      ],
      price: {
        current: 39.99,
        historicalLow: 39.99,
        currency: 'USD',
        store: 'Fanatical',
      },
      affiliateUrl: 'https://www.fanatical.com/en/game/elden-ring',
      cached: false,
    }
  }
  if (s === 'cyberpunk-2077') {
    return {
      gameName: 'Cyberpunk 2077',
      verdict: 'wait',
      reasons: [
        '86 Metacritic score — incredibly detailed neon-lit cityscape with top-tier narrative.',
        'Current price of $29.99 is significantly above the historical all-time low of $19.99.',
        'Frequent CD Projekt Red publisher sales occur where the price drops by another 50%.',
      ],
      price: {
        current: 29.99,
        historicalLow: 19.99,
        currency: 'USD',
        store: 'Humble Store',
      },
      affiliateUrl: 'https://www.humblebundle.com/store/cyberpunk-2077',
      cached: false,
    }
  }
  if (s === 'portal-2') {
    return {
      gameName: 'Portal 2',
      verdict: 'buy',
      reasons: [
        '95 Metacritic score — one of the greatest co-op and single-player puzzle games ever made.',
        'Incredibly cheap pricing history, regularly discounted to less than $2.00.',
        'Fantastic pacing, clever writing, and timeless mechanics that hold up perfectly today.',
      ],
      price: {
        current: 0.99,
        historicalLow: 0.99,
        currency: 'USD',
        store: 'Steam',
      },
      affiliateUrl: 'https://store.steampowered.com/search/?term=Portal%202',
      cached: false,
    }
  }
  return null
}

export async function fetchVerdict(gameSlug: string): Promise<VerdictResult> {
  if (!gameSlug) {
    throw new Error('Game slug is required')
  }

  // Local fallback mock verdicts to enable local UI testing/verification without real API keys
  if (
    !process.env.VITEST &&
    (env.GEMINI_API_KEY.includes('dummy') ||
      env.RAWG_API_KEY.includes('dummy') ||
      env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder'))
  ) {
    const mockVerdict = getMockVerdict(gameSlug)
    if (mockVerdict) {
      return mockVerdict
    }
  }

  // 1. Check cache first
  const cached = await getCachedVerdict(gameSlug)

  if (cached) {
    // Cache Hit! Fetch pricing fresh — verdict/rating come from the DB.
    let freshPrice: PriceData | null = null
    try {
      freshPrice = await getGamePrice(cached.game_name)
    } catch (e) {
      console.error('Failed to fetch fresh price for cached game:', e)
    }

    // Use cached pricing as fallback if CheapShark fails or returns null
    let finalPrice: PriceData | null = freshPrice
    if (
      !finalPrice &&
      cached.current_price !== null &&
      cached.current_price !== undefined &&
      cached.historical_low !== null &&
      cached.historical_low !== undefined
    ) {
      finalPrice = {
        current: Number(cached.current_price),
        historicalLow: Number(cached.historical_low),
        currency: cached.currency,
        store: 'Cached Store',
      }
    }

    // Build affiliate URL or fallback to Steam search
    let affiliateUrl = `https://store.steampowered.com/search/?term=${encodeURIComponent(cached.game_name)}`
    if (finalPrice) {
      if (finalPrice.store === 'Steam' && finalPrice.dealId) {
        affiliateUrl = `https://store.steampowered.com/app/${finalPrice.dealId}/`
      } else if (getStoreKey(finalPrice.store)) {
        try {
          const constructed = buildAffiliateUrl(finalPrice.store, gameSlug)
          if (validateAffiliateUrl(constructed)) {
            affiliateUrl = constructed
          }
        } catch (e) {
          console.error('Failed to construct affiliate URL:', e)
        }
      }
    }

    return {
      gameName: cached.game_name,
      verdict: cached.verdict,
      reasons: cached.reasons,
      criticScore: cached.metacritic_score ?? undefined,
      userRating: cached.user_rating ?? undefined,
      price: finalPrice || undefined,
      affiliateUrl,
      cached: true,
    }
  }

  // Cache Miss or Stale!
  // 2. Fetch game details from RAWG
  const gameDetails = await getGameDetails(gameSlug)

  // 3. Fetch pricing + web enrichment in parallel
  const [priceResult, enrichment] = await Promise.allSettled([
    getGamePrice(gameDetails.name),
    fetchWebEnrichment(gameDetails.name, gameDetails.released),
  ])

  const price: PriceData | null = priceResult.status === 'fulfilled' ? priceResult.value : null
  if (priceResult.status === 'rejected')
    console.error('Failed to fetch pricing from ITAD:', priceResult.reason)

  const { metacriticScore, sentiment } =
    enrichment.status === 'fulfilled'
      ? enrichment.value
      : { metacriticScore: null, sentiment: null }

  // Backfill Metacritic score from web search when RAWG has no data
  if (gameDetails.metacritic === undefined && metacriticScore !== null) {
    gameDetails.metacritic = metacriticScore
  }

  // 4. Generate verdict from Gemini AI
  const aiVerdict = await getVerdictFromAI(gameDetails, price, sentiment)

  // 5. Save in cache
  await upsertCachedVerdict(
    gameSlug,
    gameDetails.name,
    aiVerdict.verdict,
    aiVerdict.reasons,
    gameDetails.metacritic,
    gameDetails.rating,
    price?.current,
    price?.historicalLow
  )

  // 6. Build affiliate URL — use Steam store page if we have appid, otherwise search fallback
  let affiliateUrl = `https://store.steampowered.com/search/?term=${encodeURIComponent(gameDetails.name)}`
  if (price) {
    if (price.store === 'Steam' && price.dealId) {
      affiliateUrl = `https://store.steampowered.com/app/${price.dealId}/`
    } else if (getStoreKey(price.store)) {
      try {
        const constructed = buildAffiliateUrl(price.store, gameSlug)
        if (validateAffiliateUrl(constructed)) {
          affiliateUrl = constructed
        }
      } catch (e) {
        console.error('Failed to construct affiliate URL:', e)
      }
    }
  }

  return {
    gameName: gameDetails.name,
    verdict: aiVerdict.verdict,
    reasons: aiVerdict.reasons,
    criticScore: gameDetails.metacritic,
    userRating: gameDetails.rating,
    price: price || undefined,
    affiliateUrl,
    cached: false,
  }
}

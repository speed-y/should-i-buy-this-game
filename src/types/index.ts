export interface GameData {
  slug: string
  name: string
  description?: string
  metacritic?: number
  rating?: number
  playtime?: number
  released?: string
  backgroundImage?: string
}

export interface StorePrice {
  store: string
  price: number
  regular?: number
  cut?: number
  dealUrl?: string
  storeLow?: number
  expiry?: string
}

export interface PriceData {
  current: number
  historicalLow: number
  currency: string
  store: string
  dealId?: string
  /** ITAD affiliate link for the best deal */
  dealUrl?: string
  /** Multi-store price comparison from ITAD */
  storePrices?: StorePrice[]
  /** Original MSRP (pre-discount) */
  msrp?: number
  /** Current discount percentage (0-100) */
  discountPercent?: number
}

export interface VerdictResult {
  gameName: string
  verdict: 'buy' | 'wait' | 'skip'
  reasons: string[]
  criticScore?: number
  userRating?: number
  price?: PriceData
  affiliateUrl?: string
  cached?: boolean
}

export interface CachedVerdict {
  id: string
  game_slug: string
  game_name: string
  verdict: 'buy' | 'wait' | 'skip'
  reasons: string[]
  metacritic_score?: number
  user_rating?: number
  current_price?: number
  historical_low?: number
  currency: string
  ai_model: string
  created_at: string
  updated_at: string
}

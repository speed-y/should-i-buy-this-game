import { env } from './env'
import { GameData } from '../types'

const BASE_URL = 'https://api.rawg.io/api'

interface RawgSearchResult {
  slug: string
  name: string
  metacritic?: number | null
  rating?: number | null
  background_image?: string | null
  added?: number | null // total users who added this game — used as popularity tiebreaker
}

// Strip punctuation so "Assassin's" matches "assassins", "007" matches "007", etc.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// 0 = exact, 1 = starts-with, 2 = contains, 3 = no direct match (fuzzy from RAWG)
function matchTier(name: string, query: string): number {
  const n = normalize(name)
  const q = normalize(query)
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  if (n.includes(q)) return 2
  return 3
}

export async function searchGames(query: string): Promise<GameData[]> {
  if (!query) return []

  try {
    // Fetch more candidates than we need so the re-rank has enough to work with
    const res = await fetch(
      `${BASE_URL}/games?key=${env.RAWG_API_KEY}&search=${encodeURIComponent(query)}&page_size=12`
    )

    if (!res.ok) {
      throw new Error(`RAWG search failed with status ${res.status}`)
    }

    const data = (await res.json()) as { results?: unknown[] }
    if (!data.results || !Array.isArray(data.results)) {
      return []
    }

    const results = data.results as RawgSearchResult[]

    // Sort: name-match quality first, then popularity (added count) as tiebreaker.
    // This ensures "Elden Ring" beats "Skyrim" when searching "elden ring", while
    // still surfacing popular games when multiple titles match equally well.
    const ranked = [...results].sort((a, b) => {
      const tierDiff = matchTier(a.name, query) - matchTier(b.name, query)
      if (tierDiff !== 0) return tierDiff
      return (b.added ?? 0) - (a.added ?? 0)
    })

    return ranked.slice(0, 6).map((item) => ({
      slug: item.slug,
      name: item.name,
      metacritic: item.metacritic ?? undefined,
      rating: item.rating ?? undefined,
      backgroundImage: item.background_image ?? undefined,
    }))
  } catch (error) {
    console.error('RAWG search error:', error)
    return []
  }
}

export async function getGameDetails(slug: string): Promise<GameData> {
  if (!slug) throw new Error('Game slug is required')

  const res = await fetch(`${BASE_URL}/games/${encodeURIComponent(slug)}?key=${env.RAWG_API_KEY}`)

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Game not found')
    }
    throw new Error(`RAWG detail fetch failed with status ${res.status}`)
  }

  interface RawgGameDetail {
    slug: string
    name: string
    description_raw?: string | null
    description?: string | null
    metacritic?: number | null
    rating?: number | null
    playtime?: number | null
    released?: string | null
    background_image?: string | null
  }

  const item = (await res.json()) as RawgGameDetail

  return {
    slug: item.slug,
    name: item.name,
    description: item.description_raw || item.description || '',
    metacritic: item.metacritic ?? undefined,
    rating: item.rating ?? undefined,
    playtime: item.playtime ?? undefined,
    released: item.released ?? undefined,
    backgroundImage: item.background_image ?? undefined,
  }
}

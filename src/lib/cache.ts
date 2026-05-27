import { supabaseAdmin } from './supabase'
import { CachedVerdict } from '../types'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

export async function getCachedVerdict(gameSlug: string): Promise<CachedVerdict | null> {
  if (!gameSlug) return null

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('verdicts')
      .select('*')
      .eq('game_slug', gameSlug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No row found
        return null
      }
      console.error(`Supabase read error for slug "${gameSlug}":`, error)
      return null
    }

    if (!data) return null

    interface VerdictRow {
      id: string
      game_slug: string
      game_name: string
      verdict: 'buy' | 'wait' | 'skip'
      reasons: string[] | string
      metacritic_score: number | null
      user_rating: number | null
      current_price: number | null
      historical_low: number | null
      currency: string | null
      ai_model: string | null
      updated_at: string
      created_at: string
    }

    const row = data as unknown as VerdictRow

    // Check if cache is fresh (less than 7 days old)
    const updatedAt = new Date(row.updated_at).getTime()
    const now = Date.now()

    if (now - updatedAt <= CACHE_TTL_MS) {
      // Parse reasons if they are stringified or returned as array
      let reasons: string[] = []
      if (Array.isArray(row.reasons)) {
        reasons = row.reasons
      } else if (typeof row.reasons === 'string') {
        try {
          reasons = JSON.parse(row.reasons) as string[]
        } catch {
          reasons = []
        }
      }

      return {
        id: row.id,
        game_slug: row.game_slug,
        game_name: row.game_name,
        verdict: row.verdict,
        reasons,
        metacritic_score: row.metacritic_score ?? undefined,
        user_rating: row.user_rating ?? undefined,
        current_price: row.current_price ?? undefined,
        historical_low: row.historical_low ?? undefined,
        currency: row.currency ?? 'USD',
        ai_model: row.ai_model ?? 'gemini-3.5-flash',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    }

    return null // Cache is stale
  } catch (error) {
    console.error(`Cache read failed for slug "${gameSlug}":`, error)
    return null
  }
}

export async function upsertCachedVerdict(
  gameSlug: string,
  gameName: string,
  verdict: 'buy' | 'wait' | 'skip',
  reasons: string[],
  metacriticScore?: number,
  userRating?: number,
  currentPrice?: number,
  historicalLow?: number
): Promise<void> {
  try {
    const supabase = supabaseAdmin()
    const { error } = await supabase.from('verdicts').upsert(
      {
        // @ts-expect-error - verdicts table is not defined in generic database schema types
        game_slug: gameSlug,
        game_name: gameName,
        verdict,
        reasons,
        metacritic_score: metacriticScore ?? null,
        user_rating: userRating ?? null,
        current_price: currentPrice ?? null,
        historical_low: historicalLow ?? null,
        ai_model: 'gemini-3.5-flash',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'game_slug' }
    )

    if (error) {
      console.error(`Supabase upsert error for slug "${gameSlug}":`, error)
    }
  } catch (error) {
    console.error(`Cache write failed for slug "${gameSlug}":`, error)
  }
}

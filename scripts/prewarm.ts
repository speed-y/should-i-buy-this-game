import { env } from '../src/lib/env'
import { fetchVerdict } from '../src/lib/verdict'

const RAWG_BASE_URL = 'https://api.rawg.io/api'

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runPrewarm() {
  console.log('🚀 Starting cache pre-warming process for top 100 popular games...')

  try {
    // 1. Fetch top 100 popular games from RAWG
    const rawgApiKey = env.RAWG_API_KEY
    if (!rawgApiKey) {
      throw new Error('RAWG_API_KEY is not defined in the environment')
    }

    const res = await fetch(
      `${RAWG_BASE_URL}/games?key=${rawgApiKey}&ordering=-added&page_size=100`
    )

    if (!res.ok) {
      throw new Error(`Failed to fetch top games from RAWG: ${res.statusText}`)
    }

    const data = await res.json()
    const games = data.results
    if (!games || !Array.isArray(games)) {
      throw new Error('No games found in RAWG response')
    }

    console.log(`🎮 Found ${games.length} games. Starting orchestrator caching...`)

    let successCount = 0
    let failureCount = 0

    // 2. Loop through games and trigger orchestrator
    for (let i = 0; i < games.length; i++) {
      const game = games[i]
      console.log(`[${i + 1}/${games.length}] Pre-warming "${game.name}" (slug: ${game.slug})...`)

      try {
        const result = await fetchVerdict(game.slug)
        console.log(
          `   ✅ Success! Verdict: ${result.verdict.toUpperCase()} (Cached: ${result.cached})`
        )
        successCount++
      } catch (err: any) {
        console.error(`   ❌ Failed to pre-warm "${game.name}":`, err.message || err)
        failureCount++
      }

      // 500ms delay between requests to be polite to APIs and prevent rate limiters triggering
      await sleep(500)
    }

    console.log('\n✨ Pre-warming complete!')
    console.log(`📈 Summary: ${successCount} successful, ${failureCount} failed.`)
  } catch (error) {
    console.error('❌ Critical error during prewarming:', error)
    process.exit(1)
  }
}

// Execute prewarming
runPrewarm()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

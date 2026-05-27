import { Redis } from '@upstash/redis'
import { env } from '../src/lib/env'
import { supabaseAdmin } from '../src/lib/supabase'

async function clearCache() {
  let errors = 0

  // 1. Supabase: delete all verdict rows
  console.log('Clearing Supabase verdicts table...')
  try {
    const supabase = supabaseAdmin()
    const { error, count } = await supabase
      .from('verdicts')
      .delete({ count: 'exact' })
      .neq('game_slug', '') // matches every row
    if (error) throw error
    console.log(`  Deleted ${count ?? 'unknown'} verdict row(s).`)
  } catch (e) {
    console.error('  Supabase clear failed:', e)
    errors++
  }

  // 2. Upstash Redis: flush all pricing keys
  console.log('Flushing Upstash Redis pricing cache...')
  try {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    })
    await redis.flushdb()
    console.log('  Redis flushed.')
  } catch (e) {
    console.error('  Redis flush failed:', e)
    errors++
  }

  if (errors === 0) {
    console.log('\nAll caches cleared.')
  } else {
    console.error(`\nDone with ${errors} error(s).`)
    process.exit(1)
  }
}

clearCache()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

import { env } from '../src/lib/env'

async function migrate() {
  const sql = 'ALTER TABLE verdicts ADD COLUMN IF NOT EXISTS user_rating NUMERIC;'

  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      apikey: env.SUPABASE_SECRET_KEY,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const body = await res.text()
    // If execute_sql function doesn't exist, print manual instructions
    if (res.status === 404 || body.includes('does not exist')) {
      console.log('Auto-migration not available. Run this SQL in your Supabase SQL editor:')
      console.log('')
      console.log('  ' + sql)
      console.log('')
      console.log('Dashboard: https://app.supabase.com → your project → SQL Editor')
      process.exit(0)
    }
    throw new Error(`Migration failed: ${res.status} ${body}`)
  }

  console.log('Migration applied: user_rating column added to verdicts table.')
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

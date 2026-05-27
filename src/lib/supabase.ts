import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

// Server-only: use in route handlers and server components
// Uses secret key — never expose to client
export const supabaseAdmin = (): ReturnType<typeof createClient> =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)

// Client-safe: use in client components
export const supabaseClient = (): ReturnType<typeof createClient> =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

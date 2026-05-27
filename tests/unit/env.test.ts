import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Environment Variables Validation', () => {
  const backupEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    // Reset process.env to a clean state before each test
    process.env = { ...backupEnv }
  })

  // Helper to populate all valid env variables
  const setAllValidEnv = () => {
    process.env.RAWG_API_KEY = 'test_rawg_key'
    process.env.GEMINI_API_KEY = 'test_gemini_key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-supabase.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test_publishable_key'
    process.env.SUPABASE_SECRET_KEY = 'test_secret_key'
    process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test_redis_token'
    process.env.ITAD_API_KEY = 'test_itad_key'
  }

  it('should pass and load successfully if all variables are present and well-formed', async () => {
    setAllValidEnv()

    const { env } = await import('@/lib/env')
    expect(env.RAWG_API_KEY).toBe('test_rawg_key')
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test-supabase.supabase.co')
    expect(env.UPSTASH_REDIS_REST_URL).toBe('https://test-redis.upstash.io')
  })

  it('should throw on validation failure when a required variable is missing', async () => {
    setAllValidEnv()
    // Delete a required variable
    delete process.env.RAWG_API_KEY

    await expect(import('@/lib/env')).rejects.toThrow()
  })

  it('should throw on validation failure when NEXT_PUBLIC_SUPABASE_URL is malformed', async () => {
    setAllValidEnv()
    // Provide a malformed URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-valid-url'

    await expect(import('@/lib/env')).rejects.toThrow()
  })

  it('should throw on validation failure when UPSTASH_REDIS_REST_URL is malformed', async () => {
    setAllValidEnv()
    // Provide a malformed URL
    process.env.UPSTASH_REDIS_REST_URL = 'not-a-valid-url'

    await expect(import('@/lib/env')).rejects.toThrow()
  })
})

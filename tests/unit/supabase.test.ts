import { describe, it, expect, vi } from 'vitest'
import { supabaseAdmin, supabaseClient } from '@/lib/supabase'

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn().mockImplementation((url, key) => ({ url, key })),
  }
})

describe('Supabase Client Factories', () => {
  it('should initialize admin client correctly using service role key', () => {
    const client = supabaseAdmin() as any
    expect(client).toBeDefined()
    expect(client.url).toContain('supabase.co')
  })

  it('should initialize public client correctly using anonymous key', () => {
    const client = supabaseClient() as any
    expect(client).toBeDefined()
    expect(client.url).toContain('supabase.co')
  })
})

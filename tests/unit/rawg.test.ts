import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchGames, getGameDetails } from '@/lib/rawg'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('searchGames', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps API results to GameData shape', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            slug: 'elden-ring',
            name: 'Elden Ring',
            metacritic: 96,
            rating: 4.8,
            background_image: 'https://media.rawg.io/img.jpg',
            added: 5000,
          },
        ],
      }),
    })
    const results = await searchGames('elden ring')
    expect(results[0]).toMatchObject({
      slug: 'elden-ring',
      name: 'Elden Ring',
      metacritic: 96,
      rating: 4.8,
    })
  })

  it('ranks exact name match above partial matches', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { slug: 'elden-ring-colosseum', name: 'Elden Ring Colosseum', added: 9999 },
          { slug: 'elden-ring', name: 'Elden Ring', added: 5000 },
        ],
      }),
    })
    const results = await searchGames('elden ring')
    // Exact match must come first despite lower popularity
    expect(results[0].slug).toBe('elden-ring')
  })

  it('strips punctuation so "assassins creed" matches "Assassin\'s Creed Shadows"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { slug: 'assassins-creed-shadows', name: "Assassin's Creed Shadows", added: 3000 },
          { slug: 'some-other-game', name: 'Some Other Game', added: 9999 },
        ],
      }),
    })
    const results = await searchGames('assassins creed shadows')
    expect(results[0].slug).toBe('assassins-creed-shadows')
  })

  it('uses popularity as tiebreaker when match tier is equal', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { slug: 'portal-knights', name: 'Portal Knights', added: 1000 },
          { slug: 'portal-2', name: 'Portal 2', added: 8000 },
        ],
      }),
    })
    // Both start with "portal" (tier 1, neither is exact) — more popular should rank first
    const results = await searchGames('portal')
    expect(results[0].slug).toBe('portal-2')
  })

  it('returns empty array on API error without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'))
    await expect(searchGames('elden ring')).resolves.toEqual([])
  })

  it('returns empty array for empty query', async () => {
    await expect(searchGames('')).resolves.toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('getGameDetails', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps all fields from the RAWG detail response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        slug: 'cyberpunk-2077',
        name: 'Cyberpunk 2077',
        description_raw: 'A futuristic RPG',
        metacritic: 86,
        rating: 4.3,
        playtime: 50,
        released: '2020-12-10',
        background_image: 'https://media.rawg.io/cp.jpg',
      }),
    })
    const details = await getGameDetails('cyberpunk-2077')
    expect(details).toMatchObject({
      slug: 'cyberpunk-2077',
      name: 'Cyberpunk 2077',
      description: 'A futuristic RPG',
      metacritic: 86,
      rating: 4.3,
      playtime: 50,
      released: '2020-12-10',
    })
  })

  it('throws "Game not found" on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    await expect(getGameDetails('nonexistent')).rejects.toThrow('Game not found')
  })

  it('throws a generic error on non-404 API failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(getGameDetails('some-game')).rejects.toThrow(
      'RAWG detail fetch failed with status 500'
    )
  })
})

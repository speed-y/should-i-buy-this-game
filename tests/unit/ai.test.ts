import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getVerdictFromAI, fetchWebEnrichment } from '@/lib/ai'
import { GoogleGenAI } from '@google/genai'

vi.mock('@google/genai', () => {
  const mockGenerateContent = vi.fn()
  return {
    GoogleGenAI: class {
      models = { generateContent: mockGenerateContent }
    },
    ThinkingLevel: { LOW: 'LOW' },
  }
})

const mockFetch = vi.fn()
global.fetch = mockFetch

const game = { slug: 'elden-ring', name: 'Elden Ring', metacritic: 96 }
const price = { current: 39.99, historicalLow: 29.99, currency: 'USD', store: 'Steam' }

describe('getVerdictFromAI', () => {
  let generateMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    generateMock = new GoogleGenAI({ apiKey: 'fake' }).models.generateContent as ReturnType<
      typeof vi.fn
    >
  })

  it('returns a validated verdict on success', async () => {
    generateMock.mockResolvedValue({
      text: JSON.stringify({ verdict: 'buy', reasons: ['A', 'B', 'C'] }),
    })
    const result = await getVerdictFromAI(game, price)
    expect(result.verdict).toBe('buy')
    expect(result.reasons).toHaveLength(3)
    expect(result.gameName).toBe('Elden Ring')
  })

  it('strips ```json code fences from model response', async () => {
    generateMock.mockResolvedValue({
      text: '```json\n{"verdict":"wait","reasons":["A","B","C"]}\n```',
    })
    const result = await getVerdictFromAI(game, price)
    expect(result.verdict).toBe('wait')
  })

  it('throws when model returns fewer than 3 reasons', async () => {
    generateMock.mockResolvedValue({
      text: JSON.stringify({ verdict: 'buy', reasons: ['Only one reason'] }),
    })
    await expect(getVerdictFromAI(game, null)).rejects.toThrow(
      'AI verdict generation failed or returned invalid format'
    )
  })

  it('uses "Free to Play" in the prompt when price is $0 — never "$0.00"', async () => {
    generateMock.mockResolvedValue({
      text: JSON.stringify({ verdict: 'buy', reasons: ['A', 'B', 'C'] }),
    })
    const freePrice = { current: 0, historicalLow: 9.99, currency: 'USD', store: 'Steam' }
    await getVerdictFromAI({ slug: 'f2p-game', name: 'F2P Game' }, freePrice)
    const prompt: string = generateMock.mock.calls[0][0].contents
    expect(prompt).toContain('Free to Play (no purchase required)')
    expect(prompt).not.toContain('$0.00')
  })

  it('falls back to the next Gemini model on RESOURCE_EXHAUSTED', async () => {
    generateMock
      .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED: quota exceeded'))
      .mockResolvedValueOnce({
        text: JSON.stringify({ verdict: 'skip', reasons: ['A', 'B', 'C'] }),
      })
    const result = await getVerdictFromAI(game, price)
    expect(result.verdict).toBe('skip')
    expect(generateMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to Groq when all Gemini models are quota-exhausted', async () => {
    generateMock.mockRejectedValue(new Error('RESOURCE_EXHAUSTED'))
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ verdict: 'wait', reasons: ['X', 'Y', 'Z'] }) } },
        ],
      }),
    })

    const result = await getVerdictFromAI(game, price)
    expect(result.verdict).toBe('wait')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('does not retry other models on non-quota errors', async () => {
    generateMock.mockRejectedValueOnce(new Error('Invalid API key'))
    await expect(getVerdictFromAI(game, price)).rejects.toThrow(
      'AI verdict generation failed or returned invalid format'
    )
    expect(generateMock).toHaveBeenCalledTimes(1)
  })
})

describe('fetchWebEnrichment', () => {
  let generateMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    generateMock = new GoogleGenAI({ apiKey: 'fake' }).models.generateContent as ReturnType<
      typeof vi.fn
    >
  })

  it('parses a numeric score and sentiment from model response', async () => {
    generateMock.mockResolvedValue({
      text: 'SCORE: 91\nSENTIMENT: Critically acclaimed with strong community support.',
    })
    const result = await fetchWebEnrichment('Elden Ring')
    expect(result.metacriticScore).toBe(91)
    expect(result.sentiment).toBe('Critically acclaimed with strong community support.')
  })

  it('returns null score when model reports N/A', async () => {
    generateMock.mockResolvedValue({
      text: 'SCORE: N/A\nSENTIMENT: No critical reviews yet.',
    })
    const result = await fetchWebEnrichment('New Game')
    expect(result.metacriticScore).toBeNull()
    expect(result.sentiment).toBe('No critical reviews yet.')
  })

  it('returns null score when value is outside 0–100', async () => {
    generateMock.mockResolvedValue({ text: 'SCORE: 150\nSENTIMENT: Something.' })
    const result = await fetchWebEnrichment('Weird Game')
    expect(result.metacriticScore).toBeNull()
  })

  it('returns both nulls gracefully when the API call fails', async () => {
    generateMock.mockRejectedValue(new Error('Network error'))
    const result = await fetchWebEnrichment('Any Game')
    expect(result).toEqual({ metacriticScore: null, sentiment: null })
  })
})

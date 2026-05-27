import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { z } from 'zod'
import { env } from './env'
import { GameData, PriceData, VerdictResult } from '../types'

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })

// Tried in order — moves to next on quota exhaustion
const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
] as const

const verdictSchema = z.object({
  verdict: z.enum(['buy', 'wait', 'skip']),
  reasons: z.array(z.string()).length(3),
})

function isWithinDays(dateStr: string, days: number): boolean {
  return Date.now() - new Date(dateStr).getTime() < days * 24 * 60 * 60 * 1000
}

function formatPlaytime(playtime: number | undefined, released?: string): string {
  if (playtime === undefined || playtime === null) return 'N/A'
  if (playtime === 0) {
    const isNew = released ? isWithinDays(released, 90) : false
    return isNew
      ? 'N/A – not yet available (newly released)'
      : 'N/A – community playtime data unavailable'
  }
  return `${playtime} hours`
}

function buildPrompt(game: GameData, price: PriceData | null, sentiment: string | null): string {
  const isNew = game.released ? isWithinDays(game.released, 90) : false

  const metacriticLine =
    game.metacritic !== undefined
      ? `${game.metacritic}/100`
      : isNew
        ? 'N/A – scores still accumulating (newly released)'
        : 'N/A – not in Metacritic database'

  const isFree = price !== null && price.current === 0
  const priceLine = isFree
    ? 'Free to Play (no purchase required)'
    : price
      ? `$${price.current.toFixed(2)}`
      : 'N/A'
  const historicalLowLine = isFree
    ? 'N/A – game is free to play'
    : price
      ? `$${price.historicalLow.toFixed(2)}`
      : 'N/A'

  return `You are a video game purchasing advisor. Given the following data about a game, return a verdict as JSON only. No markdown, no explanation outside the JSON.

Game: ${game.name}
Released: ${game.released ?? 'N/A'}
Metacritic score: ${metacriticLine}
User rating: ${game.rating !== undefined ? `${game.rating.toFixed(1)}/5` : 'N/A'}
Current price: ${priceLine}
Historical low price: ${historicalLowLine}
Average playtime: ${formatPlaytime(game.playtime, game.released)}
Current news & sentiment: ${sentiment ?? 'N/A'}
Short description: ${game.description || 'N/A'}

Return ONLY this JSON shape:
{
  "verdict": "buy" | "wait" | "skip",
  "reasons": ["string", "string", "string"]
}

Rules:
- Always weigh BOTH Metacritic score and user rating — a game can score well with critics but poorly with the community (or vice versa); your verdict must reflect both
- Factor in the current news & sentiment when available — recent patches, controversies, or strong community reactions can outweigh numeric scores
- "buy": Metacritic 80+ AND user rating 3.5+, or exceptional value that outweighs mixed reception
- "wait": Metacritic 65–79, or user rating 3.0–3.4, or price significantly above historical low
- "skip": Metacritic below 65, or user rating below 3.0, or extremely poor value
- IMPORTANT: If the game is Free to Play, NEVER give a "wait" verdict — "wait" implies waiting for a sale which is meaningless for a free game. Only "buy" (if quality is acceptable, rating ≥ 3.0, or sentiment is decent) or "skip" (if quality is genuinely poor)
- When Metacritic is unavailable for a game released more than 90 days ago, treat user rating and online sentiment as the primary signals — do not mention waiting for reviews that will never come
- reasons must be exactly 3 short sentences, factual and specific — always reference both critic/community reception and current sentiment when data is available`
}

export interface WebEnrichment {
  metacriticScore: number | null
  sentiment: string | null
}

// Single Google Search grounding call that extracts both the Metacritic score and community sentiment.
// Called before verdict generation so missing scores can be backfilled and sentiment can inform the AI.
export async function fetchWebEnrichment(
  gameName: string,
  released?: string
): Promise<WebEnrichment> {
  const yearHint = released ? ` (${released.slice(0, 4)})` : ''
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `Look up the video game "${gameName}"${yearHint} and respond in exactly this format:

SCORE: [Metacritic score as a number 0-100, or N/A if not found]
SENTIMENT: [3-4 sentences covering critic reception, community sentiment, notable praise/complaints, and whether it is worth buying now]`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })

    const text = res.text?.trim() ?? ''

    const scoreMatch = text.match(/SCORE:\s*(\d+|N\/A)/i)
    const rawScore = scoreMatch?.[1]
    const parsed = rawScore && rawScore !== 'N/A' ? parseInt(rawScore, 10) : NaN
    const metacriticScore = !isNaN(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null

    const sentimentMatch = text.match(/SENTIMENT:\s*([\s\S]+)/i)
    const sentiment = sentimentMatch?.[1]?.trim() ?? null

    if (metacriticScore !== null) {
      // eslint-disable-next-line no-console
      console.log(`[AI] Metacritic for "${gameName}": ${metacriticScore}`)
    }
    if (sentiment) {
      // eslint-disable-next-line no-console
      console.log(`[AI] Sentiment for "${gameName}": ${sentiment.slice(0, 100)}…`)
    }

    return { metacriticScore, sentiment }
  } catch (e) {
    console.warn('[AI] Web enrichment fetch failed, proceeding without it:', e)
    return { metacriticScore: null, sentiment: null }
  }
}

function parseAndValidate(raw: string, gameName: string): VerdictResult {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text
      .replace(/^```json\s*/, '')
      .replace(/```$/, '')
      .trim()
  }
  const validated = verdictSchema.parse(JSON.parse(text))
  return { gameName, verdict: validated.verdict, reasons: validated.reasons }
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const msg = e.message
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('rate_limit_exceeded') ||
    msg.includes('429')
  )
}

async function callGeminiModel(
  model: string,
  game: GameData,
  price: PriceData | null,
  sentiment: string | null
): Promise<VerdictResult> {
  const response = await ai.models.generateContent({
    model,
    contents: buildPrompt(game, price, sentiment),
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
    },
  })
  const text = response.text
  if (!text) throw new Error(`${model} returned an empty response`)
  return parseAndValidate(text, game.name)
}

async function callGeminiWithFallbacks(
  game: GameData,
  price: PriceData | null,
  sentiment: string | null
): Promise<VerdictResult> {
  let lastError: unknown
  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiModel(model, game, price, sentiment)
    } catch (e) {
      if (isQuotaError(e)) {
        console.warn(`[AI] ${model} quota hit, trying next model`)
        lastError = e
        continue
      }
      throw e
    }
  }
  throw lastError
}

async function callGroq(
  game: GameData,
  price: PriceData | null,
  sentiment: string | null
): Promise<VerdictResult> {
  if (!env.GROQ_API_KEY) throw new Error('Groq API key not configured')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: buildPrompt(game, price, sentiment) }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Groq request failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq returned an empty response')
  return parseAndValidate(text, game.name)
}

export async function getVerdictFromAI(
  game: GameData,
  price: PriceData | null,
  sentiment: string | null = null
): Promise<VerdictResult> {
  try {
    return await callGeminiWithFallbacks(game, price, sentiment)
  } catch (e) {
    if (isQuotaError(e) && env.GROQ_API_KEY) {
      console.warn('[AI] All Gemini models exhausted, falling back to Groq')
      try {
        return await callGroq(game, price, sentiment)
      } catch (groqError) {
        console.error('[AI] Groq fallback also failed:', groqError)
      }
    } else {
      console.error('[AI] Gemini failed:', e)
    }
    throw new Error('AI verdict generation failed or returned invalid format', { cause: e })
  }
}

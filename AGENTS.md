# Should I Buy This Game? — Agent Guide

## What this project is

A Next.js app that gives AI-powered buy/wait/skip verdicts for video games, backed by real-time pricing from ITAD and Metacritic scores from RAWG + Google Search grounding.

## Stack

- **Next.js 16** (App Router, TypeScript) — `src/app/`
- **Gemini** (primary AI) + **Groq** (fallback) — `src/lib/ai.ts`
- **RAWG** (game metadata) — `src/lib/rawg.ts`
- **ITAD** (pricing) — `src/lib/pricing.ts`
- **Supabase** (verdict cache, 7-day TTL) — `src/lib/cache.ts`
- **Upstash Redis** (price cache 1h TTL, rate limiting 10 req/60s)

## Key commands

```bash
npm run dev              # start dev server
npm test                 # run all tests (36)
npm run test:security    # security/input validation tests only
npm run db:clear-cache   # wipe Supabase verdicts + Redis pricing cache
npm run db:prewarm       # pre-warm top 100 games into cache
```

## Env vars

All validated at startup via Zod in `src/lib/env.ts`. Never use `process.env` directly — always import from there. See `.env.example` for all required vars.

## Architecture

Request flow: `SearchBar` → `/game/[slug]` (SSG + ISR) → `fetchVerdict()` → cache check → RAWG + ITAD + Gemini → Supabase upsert → return.

Pricing is always fetched fresh (Redis 1h TTL). Verdicts are cached 7 days in Supabase. `user_rating` is stored in the `verdicts` table (column added via migration).

## Gotchas

- Gemini models fall back in order: `gemini-flash-latest → gemini-3.5-flash → gemini-2.5-flash → gemini-3.1-flash-lite → Groq`
- Free games (`price.current === 0`) must never get a "wait" verdict — enforced in the AI prompt
- RAWG sometimes has no Metacritic score — `fetchWebEnrichment()` in `ai.ts` uses Google Search grounding to backfill it
- `src/lib/gemini.ts` was removed — everything lives in `src/lib/ai.ts`
- AffiliateCTA component was removed — store rows in `PriceSnapshot` are the CTA

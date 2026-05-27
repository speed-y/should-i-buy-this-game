# Should I Buy This Game?

An AI-powered verdict tool for video games. Search for any game and get a **buy / wait / skip** recommendation backed by real-time pricing, Metacritic scores, and community sentiment — no fluff, just a verdict.

## How it works

1. Search for a game — autocomplete pulls from the RAWG database
2. The app fetches the current best price across stores (via IsThereAnyDeal) and the Metacritic score
3. Google Gemini analyses pricing history, critic scores, and web sentiment to produce a verdict with reasons
4. Results are cached in Supabase for 7 days so repeat lookups are instant

## Stack

- **Next.js 16** (App Router, TypeScript, ISR)
- **Google Gemini** — primary AI verdict engine, falls back through multiple models on quota exhaustion
- **Groq** — final fallback when all Gemini quota is exhausted
- **RAWG** — game metadata and search
- **IsThereAnyDeal (ITAD)** — real-time pricing across Steam, Humble, Fanatical, GMG, and more
- **Supabase** — verdict cache (7-day TTL)
- **Upstash Redis** — pricing cache (1-hour TTL) and rate limiting

## Local setup

```bash
# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env.local
# Edit .env.local with your API keys (see below)

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> If you don't have real API keys, the app falls back to hardcoded mock verdicts for `elden-ring`, `cyberpunk-2077`, and `portal-2` in development.

## Environment variables

| Variable                               | Required | Source                                                                                   |
| -------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `RAWG_API_KEY`                         | Yes      | [rawg.io/apidocs](https://rawg.io/apidocs)                                               |
| `GEMINI_API_KEY`                       | Yes      | [aistudio.google.com](https://aistudio.google.com/app/apikey)                            |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes      | Supabase project settings                                                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes      | Supabase project settings                                                                |
| `SUPABASE_SECRET_KEY`                  | Yes      | Supabase project settings                                                                |
| `UPSTASH_REDIS_REST_URL`               | Yes      | [console.upstash.com](https://console.upstash.com)                                       |
| `UPSTASH_REDIS_REST_TOKEN`             | Yes      | [console.upstash.com](https://console.upstash.com)                                       |
| `ITAD_API_KEY`                         | Yes      | [isthereanydeal.com/dev](https://isthereanydeal.com/dev/)                                |
| `GROQ_API_KEY`                         | No       | [console.groq.com](https://console.groq.com/keys) — auto-used when Gemini quota runs out |

## Database

The app expects a `verdicts` table in Supabase. Run this once in the SQL editor:

```sql
create table if not exists verdicts (
  id uuid primary key default gen_random_uuid(),
  game_slug text unique not null,
  game_name text not null,
  verdict text not null,
  reasons text[] not null,
  metacritic_score int,
  user_rating numeric,
  current_price numeric,
  historical_low numeric,
  currency text default 'USD',
  ai_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Key commands

```bash
npm run dev              # start dev server
npm test                 # run all unit tests
npm run test:security    # security / input-validation tests only
npm run db:clear-cache   # wipe all cached verdicts and pricing
npm run db:prewarm       # pre-warm top 100 games into cache
```

## License

MIT

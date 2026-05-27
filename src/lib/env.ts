import { z } from 'zod'

const envSchema = z.object({
  RAWG_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  ITAD_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1).optional(),
})

export const env = envSchema.parse(process.env)

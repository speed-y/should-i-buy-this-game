import React, { cache } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchVerdict } from '@/lib/verdict'
import VerdictCard from '@/components/VerdictCard'
import PriceSnapshot from '@/components/PriceSnapshot'
import SearchBar from '@/components/SearchBar'

const getVerdict = cache(async (slug: string) => {
  return fetchVerdict(slug)
})

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
}

// Generate highly optimized SEO metadata dynamically
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  try {
    const result = await getVerdict(slug)
    const title = `Should I Buy ${result.gameName}? AI Game Purchase Verdict`
    const description = `Read our AI-powered buying guide for ${result.gameName}. Current verdict is "${result.verdict.toUpperCase()}" with reasons, real-time pricing analysis, and discounts.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
      },
    }
  } catch {
    return {
      title: 'Game Verdict Page | Should I Buy This Game?',
      description: 'Get instant, AI-analyzed gaming buying guides and pricing snapshots.',
    }
  }
}

export default async function GameVerdictPage({ params }: Props): Promise<React.JSX.Element> {
  const { slug } = await params

  let result
  try {
    result = await getVerdict(slug)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : ''
    if (errorMessage === 'Game not found') {
      notFound()
    }

    // Internal server error display
    return (
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#08070b] px-4 py-16">
        <div className="grid-overlay" />
        <div className="relative z-10 flex w-full max-w-2xl flex-col gap-6">
          <SearchBar placeholder="Search for another game..." />
          <div className="glass-panel border-red-500/20 p-8 text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="mb-2 text-2xl font-bold text-white">Verdict Temporarily Unavailable</h2>
            <p className="mb-6 font-light text-slate-400">
              We encountered a temporary issue generating this game&apos;s AI verdict. Please check
              back shortly.
            </p>
          </div>
        </div>
      </main>
    )
  }

  // Get ambient glow class based on verdict
  const getAmbientGlowClass = (): string => {
    if (result.verdict === 'buy') return 'ambient-glow-green'
    if (result.verdict === 'wait') return 'ambient-glow-amber'
    if (result.verdict === 'skip') return 'ambient-glow-crimson'
    return ''
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-start overflow-hidden bg-[#08070b] px-4 py-16 md:px-8">
      {/* Dynamic Background Glowing Orb */}
      <div className={`ambient-glow transition-all duration-1000 ${getAmbientGlowClass()}`} />
      <div className="grid-overlay" />

      {/* Content wrapper */}
      <div className="relative z-10 mt-8 flex w-full max-w-4xl flex-col items-center gap-6">
        {/* Search Bar */}
        <div className="relative z-50 w-full">
          <SearchBar placeholder="Search for another game..." />
        </div>

        {/* Output Results */}
        <div className="flex w-full flex-col gap-6">
          <VerdictCard result={result} />
          <PriceSnapshot price={result.price} />
        </div>
      </div>
    </main>
  )
}

import React from 'react'
import SearchBar from '@/components/SearchBar'

export default function Home(): React.JSX.Element {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-start overflow-hidden bg-[#08070b] px-4 py-16 md:px-8">
      {/* Background Ornaments */}
      <div className="ambient-glow" />
      <div className="grid-overlay" />

      {/* Content wrapper */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-12">
        {/* Brand Header */}
        <div className="mt-8 flex max-w-2xl flex-col gap-3 text-center">
          <h1 className="font-display bg-gradient-to-r from-violet-400 via-indigo-200 to-emerald-400 bg-clip-text text-4xl leading-none font-extrabold tracking-tight text-transparent sm:text-6xl">
            Should I Buy This Game?
          </h1>
          <p className="mt-2 text-lg leading-relaxed font-light text-slate-400 sm:text-xl">
            Get instant, AI-analyzed gaming verdicts backed by real-time pricing trends and
            Metacritic reviews.
          </p>
        </div>

        {/* Search Bar Section */}
        <div className="relative z-50 w-full">
          <SearchBar placeholder="Search for Elden Ring, Cyberpunk 2077..." />
        </div>
      </div>
    </main>
  )
}

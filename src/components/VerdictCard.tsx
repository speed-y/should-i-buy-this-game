import React from 'react'
import { VerdictResult } from '../types'

interface VerdictCardProps {
  result: VerdictResult
}

export default function VerdictCard({ result }: VerdictCardProps): React.JSX.Element {
  const { gameName, verdict, reasons } = result

  // Verdict-specific design maps
  const configs = {
    buy: {
      cardClass: 'glow-card-emerald',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
      badgeText: 'BUY NOW',
      glowColor: 'bg-emerald-500/20',
      icon: (
        <svg
          className="h-8 w-8 text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      bulletIcon: (
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    wait: {
      cardClass: 'glow-card-amber',
      badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
      badgeText: 'WAIT FOR SALE',
      glowColor: 'bg-amber-500/20',
      icon: (
        <svg
          className="h-8 w-8 text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      bulletIcon: (
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
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
      ),
    },
    skip: {
      cardClass: 'glow-card-crimson',
      badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/30',
      badgeText: 'SKIP',
      glowColor: 'bg-red-500/20',
      icon: (
        <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      bulletIcon: (
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
    },
  }

  const currentConfig = configs[verdict] || configs.wait

  return (
    <div
      className={`glass-panel relative mx-auto w-full max-w-2xl overflow-hidden p-8 ${currentConfig.cardClass} animate-fade-in-up`}
    >
      {/* Decorative Glow Orb */}
      <div
        className={`animate-pulse-glow pointer-events-none absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full opacity-20 blur-3xl filter ${currentConfig.glowColor}`}
      />

      {/* Header Area */}
      <div className="relative z-10 flex flex-col justify-between gap-4 border-b border-white/5 pb-6 md:flex-row md:items-center">
        <div>
          <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
            AI Purchasing Verdict
          </span>
          <h2 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-white">
            {gameName}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="shrink-0">{currentConfig.icon}</div>
          <span
            className={`rounded-xl px-4 py-2 text-sm font-extrabold tracking-wider ${currentConfig.badgeClass}`}
          >
            {currentConfig.badgeText}
          </span>
        </div>
      </div>

      {/* Scores Row */}
      <div className="relative z-10 mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/2 p-4 text-center">
          <p className="mb-1 text-xs font-semibold tracking-widest text-slate-500 uppercase">
            Metacritic
          </p>
          <p
            className={`text-2xl font-extrabold ${
              result.criticScore === undefined
                ? 'text-slate-500'
                : result.criticScore >= 80
                  ? 'text-emerald-400'
                  : result.criticScore >= 65
                    ? 'text-amber-400'
                    : 'text-red-400'
            }`}
          >
            {result.criticScore !== undefined ? `${result.criticScore}` : 'N/A'}
          </p>
          {result.criticScore !== undefined && (
            <p className="mt-0.5 text-xs text-slate-500">out of 100</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/2 p-4 text-center">
          <p className="mb-1 text-xs font-semibold tracking-widest text-slate-500 uppercase">
            User Rating
          </p>
          <p
            className={`text-2xl font-extrabold ${
              result.userRating === undefined
                ? 'text-slate-500'
                : result.userRating >= 4.0
                  ? 'text-emerald-400'
                  : result.userRating >= 3.0
                    ? 'text-amber-400'
                    : 'text-red-400'
            }`}
          >
            {result.userRating !== undefined ? result.userRating.toFixed(1) : 'N/A'}
          </p>
          {result.userRating !== undefined && (
            <p className="mt-0.5 text-xs text-slate-500">out of 5</p>
          )}
        </div>
      </div>

      {/* Reasons Area */}
      <div className="relative z-10 mt-8">
        <h3 className="mb-4 text-sm font-semibold tracking-widest text-slate-400 uppercase">
          Key Rationale
        </h3>
        <ul className="flex flex-col gap-4">
          {reasons.map((reason, idx) => (
            <li
              key={idx}
              className="flex gap-4 rounded-2xl border border-white/3 bg-white/2 p-4 transition duration-200 hover:bg-white/4"
            >
              {currentConfig.bulletIcon}
              <p className="text-base leading-relaxed font-light text-slate-200">{reason}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer Area */}
      {result.cached && (
        <div className="mt-6 flex justify-end font-mono text-xs tracking-wider text-slate-500">
          <span>⚡ Served instantly from Cache</span>
        </div>
      )}
    </div>
  )
}

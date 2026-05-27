import React from 'react'
import { PriceData } from '../types'

interface PriceSnapshotProps {
  price?: PriceData
}

function formatExpiry(expiry?: string): string | null {
  if (!expiry) return null
  try {
    const d = new Date(expiry)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return 'Expired'
    if (diffDays === 1) return 'Ends today'
    if (diffDays <= 7) return `${diffDays}d left`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

export default function PriceSnapshot({ price }: PriceSnapshotProps): React.JSX.Element {
  if (!price) {
    return (
      <div className="glass-panel animate-fade-in-up mx-auto mt-6 w-full max-w-2xl border border-white/5 p-6">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm font-light">
            Pricing snapshot unavailable for this platform.
          </span>
        </div>
      </div>
    )
  }

  const { current, historicalLow, msrp, discountPercent, storePrices, dealUrl } = price
  const isFree = current === 0
  const isAtHistoricalLow = !isFree && current <= historicalLow
  const difference = current - historicalLow
  const closenessPercent = isFree
    ? 100
    : Math.min(100, Math.max(0, Math.round((historicalLow / current) * 100)))

  return (
    <div className="glass-panel animate-fade-in-up relative mx-auto mt-6 w-full max-w-2xl overflow-hidden border border-white/5 p-6">
      {/* Ambient ornament */}
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl" />

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Real-Time Pricing
        </h3>
        <span className="text-[10px] font-medium text-slate-600">Powered by IsThereAnyDeal</span>
      </div>

      {/* Primary price cards */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {/* Current Best Deal */}
        <div className="relative rounded-2xl border border-white/5 bg-white/3 p-4 text-center">
          {discountPercent && discountPercent > 0 ? (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white shadow-lg">
              -{discountPercent}% OFF
            </span>
          ) : null}
          <span className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
            Best Deal Now
          </span>
          <div
            className={`mt-1.5 text-3xl font-extrabold tabular-nums ${isFree ? 'text-emerald-400' : 'text-white'}`}
          >
            {isFree ? 'FREE' : `$${current.toFixed(2)}`}
          </div>
          {msrp && msrp > current ? (
            <span className="text-[10px] text-slate-500 line-through">${msrp.toFixed(2)} MSRP</span>
          ) : null}
          <div className="mt-1 text-[10px] font-semibold tracking-wider text-violet-400 uppercase">
            {price.store}
          </div>
        </div>

        {/* All-time historical low */}
        <div className="rounded-2xl border border-white/5 bg-white/3 p-4 text-center">
          <span className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
            All-Time Low
          </span>
          <div
            className={`mt-1.5 text-3xl font-extrabold tabular-nums ${isFree || isAtHistoricalLow ? 'text-emerald-400' : 'text-slate-300'}`}
          >
            {isFree ? 'FREE' : `$${historicalLow.toFixed(2)}`}
          </div>
          {isFree ? (
            <span className="text-[10px] font-bold text-emerald-400">✨ Free to play!</span>
          ) : isAtHistoricalLow ? (
            <span className="text-[10px] font-bold text-emerald-400">✨ You&apos;re at it!</span>
          ) : (
            <span className="text-[10px] text-slate-500">
              ${difference.toFixed(2)} above record
            </span>
          )}
        </div>
      </div>

      {/* Value meter */}
      <div className="mb-5">
        <div className="mb-1.5 flex justify-between text-xs font-medium">
          <span className="text-slate-400">
            {isFree
              ? '✨ This game is free to play — grab it now!'
              : isAtHistoricalLow
                ? '✨ At or below all-time low — buy now!'
                : closenessPercent >= 85
                  ? 'Very close to the all-time low'
                  : 'Waiting for a deeper sale is recommended'}
          </span>
          <span className="font-semibold text-slate-300">
            {isFree ? 'Free!' : `${closenessPercent}% optimal`}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/5 bg-slate-900">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isAtHistoricalLow
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : closenessPercent >= 80
                  ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                  : 'bg-gradient-to-r from-violet-500 to-amber-400'
            }`}
            style={{ width: `${closenessPercent}%` }}
          />
        </div>
      </div>

      {/* Multi-store comparison */}
      {storePrices && storePrices.length > 0 && (
        <div className="border-t border-white/5 pt-4">
          <h4 className="mb-2.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
            Compare Across Stores
          </h4>
          <div className="flex flex-col gap-1.5">
            {storePrices.map((s, i) => {
              const isBest = i === 0
              const expLabel = formatExpiry(s.expiry)
              const Tag = s.dealUrl ? 'a' : 'div'
              const linkProps = s.dealUrl
                ? { href: s.dealUrl, target: '_blank', rel: 'noopener noreferrer' }
                : {}
              return (
                <Tag
                  key={`${s.store}-${i}`}
                  {...linkProps}
                  className={`flex items-center justify-between rounded-xl transition-all ${
                    s.dealUrl ? 'cursor-pointer' : ''
                  } ${
                    isBest
                      ? 'border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 shadow-[0_0_16px_rgba(16,185,129,0.08)] hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-[0_0_24px_rgba(16,185,129,0.18)]'
                      : 'border border-white/5 bg-white/2 px-3.5 py-2.5 hover:bg-white/5'
                  }`}
                >
                  {/* Left: store name + labels */}
                  <div className="flex min-w-0 items-center gap-2">
                    {isBest && (
                      <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-emerald-400 uppercase">
                        Best
                      </span>
                    )}
                    <span
                      className={`truncate ${isBest ? 'text-sm font-semibold text-white' : 'text-sm font-medium text-slate-300'}`}
                    >
                      {s.store}
                    </span>
                    {expLabel && (
                      <span className="shrink-0 text-[9px] font-medium text-amber-400">
                        {expLabel}
                      </span>
                    )}
                  </div>

                  {/* Right: price + discount + CTA */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    {s.cut && s.cut > 0 ? (
                      <span className="text-[10px] font-semibold text-emerald-500">-{s.cut}%</span>
                    ) : null}
                    <span
                      className={`font-bold tabular-nums ${isBest ? 'text-base text-emerald-400' : 'text-sm text-slate-200'}`}
                    >
                      {s.price === 0 ? 'FREE' : `$${s.price.toFixed(2)}`}
                    </span>
                    {s.storeLow != null && (
                      <span className="hidden text-[9px] text-slate-600 tabular-nums sm:inline">
                        low: ${s.storeLow.toFixed(2)}
                      </span>
                    )}
                    {isBest && s.dealUrl ? (
                      <span className="rounded-lg bg-emerald-400 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-900">
                        Get Deal
                      </span>
                    ) : s.dealUrl ? (
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    ) : null}
                  </div>
                </Tag>
              )
            })}
          </div>
          <p className="mt-2.5 text-center text-[9px] text-slate-600">
            Prices update hourly • Deals may expire • Some links may be affiliate links
          </p>
        </div>
      )}

      {/* Best deal CTA if only one store */}
      {(!storePrices || storePrices.length <= 1) && dealUrl && (
        <div className="border-t border-white/5 pt-4">
          <a
            href={dealUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Get This Deal at {price.store}
          </a>
        </div>
      )}
    </div>
  )
}

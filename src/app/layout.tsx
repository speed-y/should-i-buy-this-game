import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Should I Buy This Game? — AI Game Purchase Advisor',
  description:
    'Get instant AI-powered verdicts on whether to buy, wait, or skip any game — with real-time pricing, Metacritic scores, and historical lows.',
  openGraph: {
    title: 'Should I Buy This Game?',
    description: 'AI-powered game purchase verdicts with real-time pricing.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.JSX.Element {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  )
}

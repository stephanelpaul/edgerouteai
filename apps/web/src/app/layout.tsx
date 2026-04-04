import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EdgeRouteAI — Open Source LLM Gateway',
  description: 'BYOK LLM API gateway built on the edge. One endpoint, every model.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSearchParams } from 'next/navigation'

interface Stats {
  totalRequests: number
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 p-6">
      <p className="text-sm text-neutral-400">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { apiUrl, isAuthenticated, isLoading, user, logout } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false)

  useEffect(() => {
    if (searchParams.get('welcome') === 'superadmin') {
      setShowWelcomeBanner(true)
      // Remove the query param from the URL without reload
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    fetch(`${apiUrl}/api/stats?days=7`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if ((data as any).error) throw new Error((data as any).error.message ?? 'Failed to load stats')
        setStats((data as any).stats ?? data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isAuthenticated, apiUrl])

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><p className="text-neutral-500">Loading...</p></div>
  }

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  const totalTokens = stats ? (stats.totalInputTokens ?? 0) + (stats.totalOutputTokens ?? 0) : 0

  return (
    <div>
      {showWelcomeBanner && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-300">Welcome, Superadmin!</p>
            <p className="text-sm text-amber-400/80 mt-0.5">You are the first user — you have been granted superadmin access. Set up your provider keys to get started.</p>
          </div>
          <button onClick={() => setShowWelcomeBanner(false)} className="ml-4 text-amber-400/60 hover:text-amber-300 text-lg leading-none">&times;</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="mt-2 text-neutral-400">Your usage across all models (last 7 days).</p>
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="text-sm text-neutral-400">{user.email}</span>}
          <button
            onClick={() => { window.location.href = `${apiUrl}/api/export/stats?format=csv&days=30` }}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-900 transition"
          >
            Export Stats
          </button>
          <button
            onClick={logout}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-900 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {loading && <p className="mt-8 text-neutral-500">Loading...</p>}
      {error && <p className="mt-8 text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          <div className="mt-8 grid grid-cols-3 gap-6">
            <StatCard title="Total Spend" value={stats ? `$${(stats.totalCost ?? 0).toFixed(4)}` : '$0.00'} />
            <StatCard title="Requests" value={stats ? String(stats.totalRequests ?? 0) : '0'} />
            <StatCard title="Tokens" value={stats ? totalTokens.toLocaleString() : '0'} />
          </div>
          {(!stats || (stats.totalRequests ?? 0) === 0) && (
            <div className="mt-8 rounded-lg border border-neutral-800 p-6">
              <p className="text-neutral-500 text-center py-12">
                No data yet. Make your first API request to see usage stats.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

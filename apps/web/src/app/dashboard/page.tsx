'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

interface Stats {
  totalRequests: number
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
}

function ConnectForm() {
  const { setApiKey } = useAuth()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed.startsWith('sk-er-')) {
      setError('API key must start with sk-er-')
      return
    }
    setApiKey(trimmed)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 p-8">
        <h2 className="text-xl font-bold">Connect your API key</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Enter your EdgeRouteAI API key to access the dashboard. You can find this in your account settings.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError('') }}
            placeholder="sk-er-..."
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-500 transition"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  )
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
  const { apiKey, apiUrl, isAuthenticated, setApiKey } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated || !apiKey) return
    setLoading(true)
    fetch(`${apiUrl}/api/stats?days=7`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error.message ?? 'Failed to load stats')
        setStats(data.stats ?? data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isAuthenticated, apiKey, apiUrl])

  if (!isAuthenticated) return <ConnectForm />

  const totalTokens = stats ? (stats.totalInputTokens ?? 0) + (stats.totalOutputTokens ?? 0) : 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="mt-2 text-neutral-400">Your usage across all models (last 7 days).</p>
        </div>
        <button
          onClick={() => setApiKey(null)}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-900 transition"
        >
          Disconnect
        </button>
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

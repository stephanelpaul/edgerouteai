'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

interface LogEntry {
  id: string
  createdAt: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  latencyMs: number
  status: string
  statusCode?: number
}

export default function LogsPage() {
  const { apiKey, apiUrl, isAuthenticated } = useAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadLogs = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${apiUrl}/api/logs`, { headers: { Authorization: `Bearer ${apiKey}` } })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error?.message ?? `Error ${r.status}`)
      setLogs(data.logs ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [apiKey, apiUrl])

  useEffect(() => {
    if (isAuthenticated) loadLogs()
  }, [isAuthenticated, loadLogs])

  if (!isAuthenticated) {
    return <p className="text-neutral-500">Please connect your API key from the Overview page.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Request Logs</h1>
          <p className="mt-1 text-neutral-400">View your API request history.</p>
        </div>
        <button
          onClick={loadLogs}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-800 bg-neutral-900/50">
            <tr>
              {['Time', 'Provider', 'Model', 'Tokens', 'Cost', 'Latency', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-neutral-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-500">Loading...</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-500">No requests yet.</td></tr>
            )}
            {!loading && logs.map((log) => (
              <tr key={log.id} className="border-t border-neutral-800/50 hover:bg-neutral-900/30 transition">
                <td className="px-4 py-3 text-neutral-400">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 capitalize">{log.provider}</td>
                <td className="px-4 py-3 text-neutral-300">{log.model}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {((log.inputTokens ?? 0) + (log.outputTokens ?? 0)).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  ${(log.cost ?? 0).toFixed(6)}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {log.latencyMs != null ? `${log.latencyMs}ms` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    log.status === 'success' || log.statusCode === 200
                      ? 'bg-green-950/50 text-green-400'
                      : 'bg-red-950/50 text-red-400'
                  }`}>
                    {log.status ?? (log.statusCode === 200 ? 'success' : 'error')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

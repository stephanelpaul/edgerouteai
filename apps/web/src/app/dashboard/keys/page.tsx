'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt?: string
}

export default function KeysPage() {
  const { apiUrl, isAuthenticated } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${apiUrl}/api/keys`, { credentials: 'include' })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setKeys((data as any).keys ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  useEffect(() => {
    if (isAuthenticated) loadKeys()
  }, [isAuthenticated, loadKeys])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const r = await fetch(`${apiUrl}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setNewKeyValue((data as any).key)
      setNewKeyName('')
      setShowForm(false)
      loadKeys()
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this key? This cannot be undone.')) return
    setRevoking(id)
    try {
      const r = await fetch(`${apiUrl}/api/keys/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      }
      setKeys((prev) => prev.filter((k) => k.id !== id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRevoking(null)
    }
  }

  if (!isAuthenticated) {
    return <p className="text-neutral-500">Please sign in to access this page.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-neutral-400">Create and manage your EdgeRouteAI API keys.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setCreateError('') }}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
        >
          Create Key
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-lg border border-neutral-800 p-6 space-y-4">
          <h2 className="font-medium">New API Key</h2>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => { setNewKeyName(e.target.value); setCreateError('') }}
            placeholder="Key name (e.g. production)"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
          />
          {createError && <p className="text-sm text-red-400">{createError}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {newKeyValue && (
        <div className="mt-6 rounded-lg border border-green-800 bg-green-950/30 p-6">
          <p className="font-medium text-green-400">Key created — copy it now, it won&apos;t be shown again.</p>
          <code className="mt-2 block break-all rounded bg-neutral-900 p-3 text-sm text-green-300">{newKeyValue}</code>
          <button
            onClick={() => setNewKeyValue(null)}
            className="mt-3 text-sm text-neutral-500 hover:text-neutral-300 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading && <p className="mt-8 text-neutral-500">Loading...</p>}

      {!loading && keys.length === 0 && !showForm && (
        <div className="mt-8 rounded-lg border border-neutral-800 p-12 text-center">
          <p className="text-neutral-500">No API keys yet.</p>
          <p className="text-sm text-neutral-600 mt-1">Create your first API key to start using EdgeRouteAI.</p>
        </div>
      )}

      {!loading && keys.length > 0 && (
        <div className="mt-8 space-y-3">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border border-neutral-800 p-4">
              <div>
                <p className="font-medium">{key.name}</p>
                <p className="text-sm text-neutral-500">
                  {key.prefix}••• · Created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                disabled={revoking === key.id}
                className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
              >
                {revoking === key.id ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

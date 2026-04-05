'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
}

interface Transform {
  id: string
  apiKeyId: string
  apiKeyName: string
  type: string
  value: string
  isActive: boolean
  createdAt: number
}

const TRANSFORM_TYPES = [
  {
    value: 'prepend_system',
    label: 'Prepend System Message',
    description: 'Insert a system message before all other messages',
    valuePlaceholder: 'You are a helpful assistant specialized in...',
    valueLabel: 'System message content',
    isJson: false,
  },
  {
    value: 'append_system',
    label: 'Append to System Message',
    description: 'Append text to an existing system message (or create one)',
    valuePlaceholder: 'Always respond in a professional tone.',
    valueLabel: 'Content to append',
    isJson: false,
  },
  {
    value: 'set_parameter',
    label: 'Set Default Parameter',
    description: 'Inject default request parameters (only if not already set by the caller)',
    valuePlaceholder: '{"temperature": 0.7, "max_tokens": 1024}',
    valueLabel: 'Parameters (JSON object)',
    isJson: true,
  },
]

export default function TransformsPage() {
  const { apiUrl, isAuthenticated } = useAuth()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [transforms, setTransforms] = useState<Transform[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [selectedType, setSelectedType] = useState('prepend_system')
  const [value, setValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [keysRes, transformsRes] = await Promise.all([
        fetch(`${apiUrl}/api/keys`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/transforms`, { credentials: 'include' }),
      ])
      const keysData = await keysRes.json()
      const transformsData = await transformsRes.json()
      if (!keysRes.ok) throw new Error((keysData as any).error?.message ?? `Error ${keysRes.status}`)
      const keys = ((keysData as any).keys ?? []).filter((k: any) => !k.revokedAt)
      setApiKeys(keys)
      setTransforms((transformsData as any).transforms ?? [])
      if (keys.length > 0 && !selectedKeyId) setSelectedKeyId(keys[0].id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, selectedKeyId])

  useEffect(() => {
    if (isAuthenticated) loadData()
  }, [isAuthenticated, loadData])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKeyId || !value.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const r = await fetch(`${apiUrl}/api/transforms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKeyId: selectedKeyId, type: selectedType, value: value.trim() }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setValue('')
      setShowForm(false)
      loadData()
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transform?')) return
    setDeleting(id)
    try {
      const r = await fetch(`${apiUrl}/api/transforms/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      }
      setTransforms((prev) => prev.filter((t) => t.id !== id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  const currentTypeConfig = TRANSFORM_TYPES.find((t) => t.value === selectedType)

  // Group transforms by apiKeyId
  const transformsByKey: Record<string, Transform[]> = {}
  for (const t of transforms) {
    if (!transformsByKey[t.apiKeyId]) transformsByKey[t.apiKeyId] = []
    transformsByKey[t.apiKeyId].push(t)
  }

  if (!isAuthenticated) {
    return <p className="text-neutral-500">Please sign in to access this page.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Request Transforms</h1>
          <p className="mt-1 text-neutral-400">
            Automatically modify requests before they reach the provider — inject system prompts or default parameters.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setCreateError('') }}
          disabled={apiKeys.length === 0}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
        >
          Add Transform
        </button>
      </div>

      {apiKeys.length === 0 && !loading && (
        <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
          You need at least one API key before adding transforms.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-lg border border-neutral-800 p-6 space-y-5">
          <h2 className="font-medium">New Transform</h2>

          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Apply to API Key</label>
            <select
              value={selectedKeyId}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
            >
              {apiKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.keyPrefix}...)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Transform Type</label>
            <div className="space-y-2">
              {TRANSFORM_TYPES.map((t) => (
                <label key={t.value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="transformType"
                    value={t.value}
                    checked={selectedType === t.value}
                    onChange={() => { setSelectedType(t.value); setValue('') }}
                    className="mt-0.5 accent-purple-600"
                  />
                  <div>
                    <p className="text-sm font-medium group-hover:text-white transition">{t.label}</p>
                    <p className="text-xs text-neutral-500">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">{currentTypeConfig?.valueLabel}</label>
            <textarea
              value={value}
              onChange={(e) => { setValue(e.target.value); setCreateError('') }}
              placeholder={currentTypeConfig?.valuePlaceholder}
              rows={currentTypeConfig?.isJson ? 4 : 3}
              required
              className={`w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none resize-y ${
                currentTypeConfig?.isJson ? 'font-mono' : ''
              }`}
            />
          </div>

          {createError && <p className="text-sm text-red-400">{createError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating || !value.trim()}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Transform'}
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

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-8 text-neutral-500">Loading...</p>}

      {!loading && transforms.length === 0 && !showForm && (
        <div className="mt-8 rounded-lg border border-neutral-800 p-12 text-center">
          <p className="text-neutral-500">No transforms configured.</p>
          <p className="text-sm text-neutral-600 mt-1">
            Add a transform to automatically inject system prompts or default parameters.
          </p>
        </div>
      )}

      {!loading && transforms.length > 0 && (
        <div className="mt-8 space-y-6">
          {apiKeys
            .filter((k) => transformsByKey[k.id]?.length > 0)
            .map((k) => (
              <div key={k.id}>
                <h2 className="text-sm font-medium text-neutral-400 mb-2">
                  {k.name} <span className="text-neutral-600 font-normal font-mono">({k.keyPrefix}...)</span>
                </h2>
                <div className="space-y-2">
                  {(transformsByKey[k.id] ?? []).map((t) => {
                    const typeConfig = TRANSFORM_TYPES.find((tc) => tc.value === t.type)
                    return (
                      <div
                        key={t.id}
                        className="rounded-lg border border-neutral-800 p-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded font-mono">
                              {t.type}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                t.isActive
                                  ? 'bg-green-950/40 text-green-400'
                                  : 'bg-neutral-800 text-neutral-500'
                              }`}
                            >
                              {t.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-neutral-300 font-mono whitespace-pre-wrap break-all line-clamp-3">
                            {t.value}
                          </p>
                          <p className="mt-1 text-xs text-neutral-600">
                            {typeConfig?.description} · Added {new Date(t.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deleting === t.id}
                          className="shrink-0 rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
                        >
                          {deleting === t.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

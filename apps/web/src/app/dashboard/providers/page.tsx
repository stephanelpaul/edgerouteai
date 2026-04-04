'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'mistral', name: 'Mistral' },
  { id: 'xai', name: 'xAI' },
]

interface ProviderKey {
  provider: string
  configured: boolean
  maskedKey?: string
}

export default function ProvidersPage() {
  const { apiUrl, isAuthenticated } = useAuth()
  const [providerKeys, setProviderKeys] = useState<Record<string, ProviderKey>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyResults, setVerifyResults] = useState<Record<string, boolean | null>>({})
  const [removing, setRemoving] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${apiUrl}/api/providers`, { credentials: 'include' })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      const map: Record<string, ProviderKey> = {}
      for (const pk of (data as any).keys ?? []) {
        map[pk.provider] = pk
      }
      setProviderKeys(map)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  useEffect(() => {
    if (isAuthenticated) loadProviders()
  }, [isAuthenticated, loadProviders])

  const handleSave = async (provider: string) => {
    if (!keyInput.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const r = await fetch(`${apiUrl}/api/providers/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setAddingFor(null)
      setKeyInput('')
      loadProviders()
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async (provider: string) => {
    setVerifying(provider)
    try {
      const r = await fetch(`${apiUrl}/api/providers/${provider}/verify`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setVerifyResults((prev) => ({ ...prev, [provider]: (data as any).valid ?? true }))
    } catch {
      setVerifyResults((prev) => ({ ...prev, [provider]: false }))
    } finally {
      setVerifying(null)
    }
  }

  const handleRemove = async (provider: string) => {
    if (!confirm(`Remove ${provider} key?`)) return
    setRemoving(provider)
    try {
      const r = await fetch(`${apiUrl}/api/providers/${provider}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      }
      setProviderKeys((prev) => {
        const next = { ...prev }
        delete next[provider]
        return next
      })
      setVerifyResults((prev) => { const n = { ...prev }; delete n[provider]; return n })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRemoving(null)
    }
  }

  if (!isAuthenticated) {
    return <p className="text-neutral-500">Please sign in to access this page.</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Provider Keys</h1>
      <p className="mt-1 text-neutral-400">Add your API keys for each LLM provider.</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-8 text-neutral-500">Loading...</p>}

      {!loading && (
        <div className="mt-8 space-y-4">
          {PROVIDERS.map((provider) => {
            const pk = providerKeys[provider.id]
            const configured = pk?.configured ?? false
            const isAddingThis = addingFor === provider.id
            const verifyResult = verifyResults[provider.id]

            return (
              <div key={provider.id} className="rounded-lg border border-neutral-800 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-sm text-neutral-500">
                      {configured
                        ? pk?.maskedKey ? `Key: ${pk.maskedKey}` : 'Configured'
                        : 'No key configured'}
                    </p>
                    {verifyResult === true && (
                      <p className="text-sm text-green-400 mt-0.5">Key is valid</p>
                    )}
                    {verifyResult === false && (
                      <p className="text-sm text-red-400 mt-0.5">Key is invalid</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {configured && (
                      <>
                        <button
                          onClick={() => handleVerify(provider.id)}
                          disabled={verifying === provider.id}
                          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition disabled:opacity-50"
                        >
                          {verifying === provider.id ? 'Verifying...' : 'Verify'}
                        </button>
                        <button
                          onClick={() => handleRemove(provider.id)}
                          disabled={removing === provider.id}
                          className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
                        >
                          {removing === provider.id ? 'Removing...' : 'Remove'}
                        </button>
                      </>
                    )}
                    {!configured && (
                      <button
                        onClick={() => { setAddingFor(isAddingThis ? null : provider.id); setKeyInput(''); setSaveError('') }}
                        className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition"
                      >
                        {isAddingThis ? 'Cancel' : 'Add Key'}
                      </button>
                    )}
                  </div>
                </div>

                {isAddingThis && (
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={keyInput}
                      onChange={(e) => { setKeyInput(e.target.value); setSaveError('') }}
                      placeholder={`Paste your ${provider.name} API key`}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
                    />
                    {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                    <button
                      onClick={() => handleSave(provider.id)}
                      disabled={saving || !keyInput.trim()}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Key'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

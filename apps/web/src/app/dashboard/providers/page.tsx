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
  id: string
  provider: string
  label: string | null
  isValid: boolean | null
  lastVerifiedAt: string | null
  createdAt: string
}

export default function ProvidersPage() {
  const { apiUrl, isAuthenticated } = useAuth()
  const [keys, setKeys] = useState<ProviderKey[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // addingFor tracks which provider card is open for adding
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyResults, setVerifyResults] = useState<Record<string, boolean | null>>({})
  const [removing, setRemoving] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${apiUrl}/api/providers`, { credentials: 'include' })
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

  const handleAdd = async (provider: string) => {
    if (!keyInput.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const r = await fetch(`${apiUrl}/api/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, apiKey: keyInput.trim(), label: labelInput.trim() || 'Default' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setAddingFor(null)
      setKeyInput('')
      setLabelInput('')
      loadKeys()
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async (keyId: string) => {
    setVerifying(keyId)
    try {
      const r = await fetch(`${apiUrl}/api/providers/${keyId}/verify`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setVerifyResults((prev) => ({ ...prev, [keyId]: (data as any).valid ?? true }))
    } catch {
      setVerifyResults((prev) => ({ ...prev, [keyId]: false }))
    } finally {
      setVerifying(null)
    }
  }

  const handleRemove = async (keyId: string, provider: string) => {
    if (!confirm(`Remove this ${provider} key?`)) return
    setRemoving(keyId)
    try {
      const r = await fetch(`${apiUrl}/api/providers/${keyId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      }
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
      setVerifyResults((prev) => { const n = { ...prev }; delete n[keyId]; return n })
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
      <p className="mt-1 text-neutral-400">Add API keys for each LLM provider. Multiple keys per provider enable load balancing.</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-8 text-neutral-500">Loading...</p>}

      {!loading && (
        <div className="mt-8 space-y-4">
          {PROVIDERS.map((provider) => {
            const providerKeys = keys.filter((k) => k.provider === provider.id)
            const keyCount = providerKeys.length
            const isAddingThis = addingFor === provider.id

            return (
              <div key={provider.id} className="rounded-lg border border-neutral-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">
                      {provider.name}
                      {keyCount > 0 && (
                        <span className="ml-2 text-xs text-neutral-500 font-normal">
                          ({keyCount} {keyCount === 1 ? 'key' : 'keys'})
                        </span>
                      )}
                    </p>
                    {keyCount === 0 && (
                      <p className="text-sm text-neutral-500">No keys configured</p>
                    )}
                    {keyCount > 1 && (
                      <p className="text-xs text-purple-400 mt-0.5">Load balancing active</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setAddingFor(isAddingThis ? null : provider.id)
                      setKeyInput('')
                      setLabelInput('')
                      setSaveError('')
                    }}
                    className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition"
                  >
                    {isAddingThis ? 'Cancel' : 'Add Key'}
                  </button>
                </div>

                {/* Existing keys list */}
                {providerKeys.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {providerKeys.map((pk) => {
                      const verifyResult = verifyResults[pk.id]
                      return (
                        <div key={pk.id} className="flex items-center justify-between rounded-md bg-neutral-900/50 px-3 py-2.5">
                          <div>
                            <p className="text-sm text-neutral-200">{pk.label || 'Default'}</p>
                            <p className="text-xs text-neutral-500">
                              Added {new Date(pk.createdAt).toLocaleDateString()}
                              {pk.isValid === true && ' · Valid'}
                              {pk.isValid === false && ' · Invalid'}
                            </p>
                            {verifyResult === true && (
                              <p className="text-xs text-green-400 mt-0.5">Verification passed</p>
                            )}
                            {verifyResult === false && (
                              <p className="text-xs text-red-400 mt-0.5">Verification failed</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVerify(pk.id)}
                              disabled={verifying === pk.id}
                              className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800 transition disabled:opacity-50"
                            >
                              {verifying === pk.id ? 'Checking...' : 'Verify'}
                            </button>
                            <button
                              onClick={() => handleRemove(pk.id, provider.name)}
                              disabled={removing === pk.id}
                              className="rounded-md border border-red-900 px-2.5 py-1 text-xs text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
                            >
                              {removing === pk.id ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add key form */}
                {isAddingThis && (
                  <div className="space-y-3 border-t border-neutral-800 pt-3">
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      placeholder={`Label (e.g. "Production key")`}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={keyInput}
                      onChange={(e) => { setKeyInput(e.target.value); setSaveError('') }}
                      placeholder={`Paste your ${provider.name} API key`}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
                    />
                    {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                    <button
                      onClick={() => handleAdd(provider.id)}
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

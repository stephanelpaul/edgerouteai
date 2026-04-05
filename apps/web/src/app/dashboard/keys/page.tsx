'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  retryCount: number
  timeoutMs: number
  createdAt: string
  lastUsedAt?: string
  revokedAt?: string
}

interface Budget {
  id: string
  apiKeyId: string
  apiKeyName: string
  monthlyLimitUsd: number
  currentSpendUsd: number
  periodStart: string
  isDisabled: boolean
}

export default function KeysPage() {
  const { apiUrl, isAuthenticated } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyRetry, setNewKeyRetry] = useState(2)
  const [newKeyTimeout, setNewKeyTimeout] = useState(30)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [budgetKeyId, setBudgetKeyId] = useState<string | null>(null)
  const [budgetAmount, setBudgetAmount] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetError, setBudgetError] = useState('')
  const [retryKeyId, setRetryKeyId] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(2)
  const [timeoutSec, setTimeoutSec] = useState(30)
  const [savingRetry, setSavingRetry] = useState(false)
  const [retryError, setRetryError] = useState('')

  const loadKeys = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [keysRes, budgetsRes] = await Promise.all([
        fetch(`${apiUrl}/api/keys`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/budgets`, { credentials: 'include' }),
      ])
      const keysData = await keysRes.json()
      const budgetsData = await budgetsRes.json()
      if (!keysRes.ok) throw new Error((keysData as any).error?.message ?? `Error ${keysRes.status}`)
      setKeys((keysData as any).keys ?? [])
      setBudgets((budgetsData as any).budgets ?? [])
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
        body: JSON.stringify({
          name: newKeyName.trim(),
          retryCount: newKeyRetry,
          timeoutMs: newKeyTimeout * 1000,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setNewKeyValue((data as any).key)
      setNewKeyName('')
      setNewKeyRetry(2)
      setNewKeyTimeout(30)
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

  const handleSaveBudget = async (keyId: string) => {
    const amount = parseFloat(budgetAmount)
    if (!amount || amount <= 0) {
      setBudgetError('Enter a valid dollar amount')
      return
    }
    setSavingBudget(true)
    setBudgetError('')
    try {
      const r = await fetch(`${apiUrl}/api/budgets/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ monthlyLimitUsd: amount }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setBudgetKeyId(null)
      setBudgetAmount('')
      loadKeys()
    } catch (err: any) {
      setBudgetError(err.message)
    } finally {
      setSavingBudget(false)
    }
  }

  const handleRemoveBudget = async (keyId: string) => {
    if (!confirm('Remove budget limit for this key?')) return
    try {
      const r = await fetch(`${apiUrl}/api/budgets/${keyId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!r.ok) {
        const data = await r.json()
        throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      }
      loadKeys()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSaveRetry = async (keyId: string) => {
    setSavingRetry(true)
    setRetryError('')
    try {
      const r = await fetch(`${apiUrl}/api/keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ retryCount, timeoutMs: timeoutSec * 1000 }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
      setRetryKeyId(null)
      loadKeys()
    } catch (err: any) {
      setRetryError(err.message)
    } finally {
      setSavingRetry(false)
    }
  }

  const getBudgetForKey = (keyId: string) => budgets.find((b) => b.apiKeyId === keyId)

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
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Key name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => { setNewKeyName(e.target.value); setCreateError('') }}
              placeholder="e.g. production"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">
                Retry count <span className="text-neutral-600">(0–5)</span>
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={newKeyRetry}
                onChange={(e) => setNewKeyRetry(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-neutral-600">Retries on 429/5xx with exponential backoff</p>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">
                Timeout <span className="text-neutral-600">(5–60s)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={newKeyTimeout}
                  onChange={(e) => setNewKeyTimeout(Number(e.target.value))}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">s</span>
              </div>
              <p className="mt-1 text-xs text-neutral-600">Per-request timeout before abort</p>
            </div>
          </div>

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
          {keys.map((key) => {
            const budget = getBudgetForKey(key.id)
            const isEditingBudget = budgetKeyId === key.id
            const isEditingRetry = retryKeyId === key.id
            const spendPct = budget
              ? Math.min(100, (budget.currentSpendUsd / budget.monthlyLimitUsd) * 100)
              : 0

            return (
              <div key={key.id} className="rounded-lg border border-neutral-800 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="text-sm text-neutral-500">
                      {key.keyPrefix}••• · Created {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {key.retryCount ?? 2} retries · {((key.timeoutMs ?? 30000) / 1000)}s timeout
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => {
                        setRetryKeyId(isEditingRetry ? null : key.id)
                        setRetryCount(key.retryCount ?? 2)
                        setTimeoutSec((key.timeoutMs ?? 30000) / 1000)
                        setRetryError('')
                      }}
                      className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition"
                    >
                      {isEditingRetry ? 'Cancel' : 'Retry/Timeout'}
                    </button>
                    <button
                      onClick={() => {
                        setBudgetKeyId(isEditingBudget ? null : key.id)
                        setBudgetAmount(budget ? String(budget.monthlyLimitUsd) : '')
                        setBudgetError('')
                      }}
                      className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition"
                    >
                      {isEditingBudget ? 'Cancel' : budget ? 'Edit Budget' : 'Set Budget'}
                    </button>
                    <button
                      onClick={() => handleRevoke(key.id)}
                      disabled={revoking === key.id}
                      className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
                    >
                      {revoking === key.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                </div>

                {/* Retry/Timeout edit */}
                {isEditingRetry && (
                  <div className="mt-3 pt-3 border-t border-neutral-800">
                    <p className="text-sm text-neutral-400 mb-3">Retry &amp; Timeout settings</p>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Retry count (0–5)</label>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={retryCount}
                          onChange={(e) => { setRetryCount(Number(e.target.value)); setRetryError('') }}
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Timeout in seconds (5–60)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min={5}
                            max={60}
                            value={timeoutSec}
                            onChange={(e) => { setTimeoutSec(Number(e.target.value)); setRetryError('') }}
                            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none pr-7"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500">s</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSaveRetry(key.id)}
                        disabled={savingRetry}
                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
                      >
                        {savingRetry ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    {retryError && <p className="mt-2 text-xs text-red-400">{retryError}</p>}
                  </div>
                )}

                {/* Budget display */}
                {budget && !isEditingBudget && (
                  <div className="mt-3 pt-3 border-t border-neutral-800">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-neutral-400">
                        Monthly budget: ${budget.currentSpendUsd.toFixed(4)} / ${budget.monthlyLimitUsd.toFixed(2)}
                      </span>
                      {budget.isDisabled && (
                        <span className="text-xs font-medium text-red-400 bg-red-950/40 px-2 py-0.5 rounded">
                          Limit reached
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveBudget(key.id)}
                        className="text-xs text-neutral-600 hover:text-neutral-400 transition"
                      >
                        Remove limit
                      </button>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          spendPct >= 100 ? 'bg-red-500' : spendPct >= 80 ? 'bg-yellow-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${spendPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Budget edit form */}
                {isEditingBudget && (
                  <div className="mt-3 pt-3 border-t border-neutral-800">
                    <p className="text-sm text-neutral-400 mb-2">Monthly spending limit (USD)</p>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={budgetAmount}
                          onChange={(e) => { setBudgetAmount(e.target.value); setBudgetError('') }}
                          placeholder="10.00"
                          className="pl-7 w-36 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveBudget(key.id)}
                        disabled={savingBudget}
                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
                      >
                        {savingBudget ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    {budgetError && <p className="mt-2 text-xs text-red-400">{budgetError}</p>}
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

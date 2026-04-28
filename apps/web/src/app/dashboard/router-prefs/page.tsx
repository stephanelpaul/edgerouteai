'use client'
import { useAuth } from '@/lib/auth-context'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface ApiKey {
	id: string
	name: string
	keyPrefix: string
	revokedAt?: string
}

interface RouterPref {
	id: string
	apiKeyId: string | null
	pinnedProviders: string[]
	excludedProviders: string[]
	maxCostPerRequestCents: number | null
	updatedAt: number
}

const PROVIDERS = [
	'openai',
	'anthropic',
	'google',
	'mistral',
	'xai',
	'groq',
	'together',
	'cloudflare',
	'cohere',
	'ollama',
	'azure',
] as const

type Mode = 'pinned' | 'excluded' | 'none'

const SCOPE_DEFAULT = '__default__'

export default function RouterPrefsPage() {
	const { apiUrl, isAuthenticated } = useAuth()
	const [keys, setKeys] = useState<ApiKey[]>([])
	const [prefs, setPrefs] = useState<RouterPref[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	// Form state — keyed off the currently-selected scope.
	const [scope, setScope] = useState<string>(SCOPE_DEFAULT)
	const [providerModes, setProviderModes] = useState<Record<string, Mode>>({})
	const [maxCostInput, setMaxCostInput] = useState<string>('')
	const [saving, setSaving] = useState(false)
	const [saveStatus, setSaveStatus] = useState<string>('')
	const [deleting, setDeleting] = useState(false)

	const load = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const [keysRes, prefsRes] = await Promise.all([
				fetch(`${apiUrl}/api/keys`, { credentials: 'include' }),
				fetch(`${apiUrl}/api/router-prefs`, { credentials: 'include' }),
			])
			const keysData = await keysRes.json()
			const prefsData = await prefsRes.json()
			if (!keysRes.ok)
				throw new Error(
					(keysData as { error?: { message?: string } }).error?.message ??
						`Error ${keysRes.status}`,
				)
			if (!prefsRes.ok)
				throw new Error(
					(prefsData as { error?: { message?: string } }).error?.message ??
						`Error ${prefsRes.status}`,
				)
			setKeys(((keysData as { keys?: ApiKey[] }).keys ?? []).filter((k) => !k.revokedAt))
			setPrefs((prefsData as { preferences?: RouterPref[] }).preferences ?? [])
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setLoading(false)
		}
	}, [apiUrl])

	useEffect(() => {
		if (isAuthenticated) load()
	}, [isAuthenticated, load])

	const activePref = useMemo(() => {
		const apiKeyId = scope === SCOPE_DEFAULT ? null : scope
		return prefs.find((p) => p.apiKeyId === apiKeyId) ?? null
	}, [prefs, scope])

	// Re-hydrate the form whenever scope or prefs change.
	useEffect(() => {
		const next: Record<string, Mode> = {}
		for (const provider of PROVIDERS) next[provider] = 'none'
		if (activePref) {
			for (const p of activePref.pinnedProviders) next[p] = 'pinned'
			for (const p of activePref.excludedProviders) next[p] = 'excluded'
			setMaxCostInput(
				activePref.maxCostPerRequestCents !== null ? String(activePref.maxCostPerRequestCents) : '',
			)
		} else {
			setMaxCostInput('')
		}
		setProviderModes(next)
		setSaveStatus('')
	}, [activePref])

	function setMode(provider: string, mode: Mode) {
		setProviderModes((prev) => ({ ...prev, [provider]: mode }))
	}

	async function handleSave() {
		setSaving(true)
		setSaveStatus('')
		try {
			const pinned: string[] = []
			const excluded: string[] = []
			for (const [provider, mode] of Object.entries(providerModes)) {
				if (mode === 'pinned') pinned.push(provider)
				else if (mode === 'excluded') excluded.push(provider)
			}
			const trimmed = maxCostInput.trim()
			const maxCost = trimmed === '' ? null : Math.max(0, Math.floor(Number(trimmed)))
			if (trimmed !== '' && Number.isNaN(maxCost)) {
				throw new Error('Max ¢/request must be a whole number')
			}
			const res = await fetch(`${apiUrl}/api/router-prefs`, {
				method: 'PUT',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					apiKeyId: scope === SCOPE_DEFAULT ? null : scope,
					pinnedProviders: pinned,
					excludedProviders: excluded,
					maxCostPerRequestCents: maxCost,
				}),
			})
			const data = await res.json()
			if (!res.ok)
				throw new Error(
					(data as { error?: { message?: string } }).error?.message ?? `Error ${res.status}`,
				)
			setSaveStatus('Saved')
			await load()
		} catch (err) {
			setSaveStatus(`Failed: ${(err as Error).message}`)
		} finally {
			setSaving(false)
		}
	}

	async function handleClear() {
		if (!activePref) return
		if (!confirm('Remove this preference row? Routing will revert to defaults for this scope.'))
			return
		setDeleting(true)
		try {
			const res = await fetch(`${apiUrl}/api/router-prefs/${activePref.id}`, {
				method: 'DELETE',
				credentials: 'include',
			})
			if (!res.ok) {
				const data = await res.json()
				throw new Error(
					(data as { error?: { message?: string } }).error?.message ?? `Error ${res.status}`,
				)
			}
			await load()
			setSaveStatus('Cleared')
		} catch (err) {
			setSaveStatus(`Failed: ${(err as Error).message}`)
		} finally {
			setDeleting(false)
		}
	}

	if (!isAuthenticated) {
		return <p className="text-neutral-500">Please sign in to access this page.</p>
	}

	return (
		<div>
			<div>
				<h1 className="text-2xl font-bold">Router preferences</h1>
				<p className="mt-1 text-neutral-400">
					Pin or exclude providers and cap per-request cost for the auto-router. Per-key settings
					override the user-default.
				</p>
			</div>

			{error && <p className="mt-4 text-sm text-red-400">{error}</p>}
			{loading && <p className="mt-8 text-neutral-500">Loading...</p>}

			{!loading && (
				<div className="mt-6 max-w-3xl space-y-6">
					{/* Scope selector */}
					<div>
						<label htmlFor="scope" className="block text-sm text-neutral-400 mb-1.5">
							Scope
						</label>
						<select
							id="scope"
							value={scope}
							onChange={(e) => setScope(e.target.value)}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
						>
							<option value={SCOPE_DEFAULT}>User default (applies to keys with no override)</option>
							{keys.map((k) => (
								<option key={k.id} value={k.id}>
									{k.name} ({k.keyPrefix}…)
								</option>
							))}
						</select>
						<p className="mt-1.5 text-xs text-neutral-500">
							{scope === SCOPE_DEFAULT
								? 'Used when no per-key row exists.'
								: 'Per-key row beats the user default.'}
						</p>
					</div>

					{/* Provider chips */}
					<div>
						<p className="text-sm text-neutral-400 mb-2">Providers</p>
						<div className="rounded-lg border border-neutral-800 p-4 space-y-2">
							{PROVIDERS.map((provider) => {
								const mode = providerModes[provider] ?? 'none'
								return (
									<div
										key={provider}
										className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-neutral-900 transition"
									>
										<span className="font-mono text-sm text-neutral-200">{provider}</span>
										<div className="flex gap-1.5">
											<ModeButton
												label="None"
												active={mode === 'none'}
												onClick={() => setMode(provider, 'none')}
											/>
											<ModeButton
												label="Pin"
												active={mode === 'pinned'}
												onClick={() => setMode(provider, 'pinned')}
												activeClass="bg-emerald-700/40 text-emerald-200 border-emerald-600"
											/>
											<ModeButton
												label="Exclude"
												active={mode === 'excluded'}
												onClick={() => setMode(provider, 'excluded')}
												activeClass="bg-red-900/40 text-red-300 border-red-800"
											/>
										</div>
									</div>
								)
							})}
						</div>
						<p className="mt-1.5 text-xs text-neutral-500">
							Pin = whitelist (only these providers eligible). Exclude = blacklist. Pin runs first,
							then exclude.
						</p>
					</div>

					{/* Cost cap */}
					<div>
						<label htmlFor="maxCost" className="block text-sm text-neutral-400 mb-1.5">
							Max cost per request (¢)
						</label>
						<input
							id="maxCost"
							type="number"
							inputMode="numeric"
							min={0}
							value={maxCostInput}
							onChange={(e) => setMaxCostInput(e.target.value)}
							placeholder="Leave empty for no cap"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
						/>
						<p className="mt-1.5 text-xs text-neutral-500">
							Whole-cent ceiling computed from list-price × (input + reserved output) tokens. Models
							above the cap are dropped from the candidate ranking.
						</p>
					</div>

					{/* Actions */}
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={handleSave}
							disabled={saving}
							className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
						>
							{saving ? 'Saving…' : 'Save'}
						</button>
						{activePref && (
							<button
								type="button"
								onClick={handleClear}
								disabled={deleting}
								className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
							>
								{deleting ? 'Removing…' : 'Remove row'}
							</button>
						)}
						{saveStatus && (
							<span
								className={`text-sm ${saveStatus.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'}`}
							>
								{saveStatus}
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

function ModeButton({
	label,
	active,
	onClick,
	activeClass = 'bg-neutral-700 text-white border-neutral-500',
}: {
	label: string
	active: boolean
	onClick: () => void
	activeClass?: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
				active
					? activeClass
					: 'border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
			}`}
		>
			{label}
		</button>
	)
}

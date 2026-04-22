'use client'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface PlatformKey {
	id: string
	provider: string
	label: string | null
	isActive: boolean
	createdAt: number
}

const PROVIDERS = ['openai', 'anthropic', 'google', 'mistral', 'xai'] as const
type Provider = (typeof PROVIDERS)[number]

const PROVIDER_LABELS: Record<Provider, string> = {
	openai: 'OpenAI',
	anthropic: 'Anthropic',
	google: 'Google',
	mistral: 'Mistral',
	xai: 'xAI',
}

export default function PlatformKeysAdminPage() {
	const { apiUrl, isSuperadmin, isLoading } = useAuth()
	const router = useRouter()
	const [keys, setKeys] = useState<PlatformKey[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [showForm, setShowForm] = useState(false)
	const [provider, setProvider] = useState<Provider>('openai')
	const [label, setLabel] = useState('Default')
	const [apiKey, setApiKey] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [toggling, setToggling] = useState<string | null>(null)
	const [deleting, setDeleting] = useState<string | null>(null)

	useEffect(() => {
		if (!isLoading && !isSuperadmin) {
			router.replace('/dashboard')
		}
	}, [isLoading, isSuperadmin, router])

	const load = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const res = await fetch(`${apiUrl}/api/admin/platform-keys`, { credentials: 'include' })
			const data = (await res.json()) as { keys?: PlatformKey[]; error?: { message?: string } }
			if (!res.ok) throw new Error(data.error?.message ?? `Error ${res.status}`)
			setKeys(data.keys ?? [])
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Failed to load')
		} finally {
			setLoading(false)
		}
	}, [apiUrl])

	useEffect(() => {
		if (isSuperadmin) load()
	}, [isSuperadmin, load])

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!apiKey.trim()) {
			setError('Paste an API key')
			return
		}
		setSubmitting(true)
		setError('')
		try {
			const res = await fetch(`${apiUrl}/api/admin/platform-keys`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ provider, label: label.trim() || 'Default', apiKey: apiKey.trim() }),
			})
			const data = (await res.json()) as { error?: { message?: string } }
			if (!res.ok) throw new Error(data.error?.message ?? `Error ${res.status}`)
			setApiKey('')
			setLabel('Default')
			setShowForm(false)
			load()
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Add failed')
		} finally {
			setSubmitting(false)
		}
	}

	const handleToggle = async (id: string, isActive: boolean) => {
		setToggling(id)
		try {
			const res = await fetch(`${apiUrl}/api/admin/platform-keys/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ isActive: !isActive }),
			})
			if (!res.ok) {
				const data = (await res.json()) as { error?: { message?: string } }
				throw new Error(data.error?.message ?? `Error ${res.status}`)
			}
			setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, isActive: !isActive } : k)))
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Toggle failed')
		} finally {
			setToggling(null)
		}
	}

	const handleDelete = async (id: string) => {
		if (
			!confirm(
				'Delete this platform key? Any requests currently relying on it will get 402/invalid-key errors.',
			)
		)
			return
		setDeleting(id)
		try {
			const res = await fetch(`${apiUrl}/api/admin/platform-keys/${id}`, {
				method: 'DELETE',
				credentials: 'include',
			})
			if (!res.ok) {
				const data = (await res.json()) as { error?: { message?: string } }
				throw new Error(data.error?.message ?? `Error ${res.status}`)
			}
			setKeys((prev) => prev.filter((k) => k.id !== id))
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Delete failed')
		} finally {
			setDeleting(null)
		}
	}

	if (!isSuperadmin) {
		return <p className="text-neutral-500">Superadmin access required.</p>
	}

	const grouped: Record<string, PlatformKey[]> = {}
	for (const k of keys) {
		if (!grouped[k.provider]) grouped[k.provider] = []
		grouped[k.provider].push(k)
	}

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Platform Keys</h1>
					<p className="mt-1 text-neutral-400">
						Upstream provider keys owned by the platform. Used for users who&apos;ve topped up
						credits but don&apos;t have their own BYOK for a given provider.
					</p>
				</div>
				<button
					onClick={() => {
						setShowForm(!showForm)
						setError('')
					}}
					className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
				>
					{showForm ? 'Cancel' : 'Add Key'}
				</button>
			</div>

			{error && (
				<div className="mt-6 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
					{error}
				</div>
			)}

			{showForm && (
				<form
					onSubmit={handleAdd}
					className="mt-6 rounded-lg border border-neutral-800 p-6 space-y-4"
				>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm text-neutral-400 mb-1.5">Provider</label>
							<select
								value={provider}
								onChange={(e) => setProvider(e.target.value as Provider)}
								className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
							>
								{PROVIDERS.map((p) => (
									<option key={p} value={p}>
										{PROVIDER_LABELS[p]}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-sm text-neutral-400 mb-1.5">Label</label>
							<input
								type="text"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder="e.g. primary, us-east"
								className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
							/>
						</div>
					</div>
					<div>
						<label className="block text-sm text-neutral-400 mb-1.5">API key</label>
						<input
							type="password"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder="sk-..."
							autoComplete="off"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-mono focus:border-purple-500 focus:outline-none"
						/>
						<p className="mt-1 text-xs text-neutral-600">
							Encrypted server-side with AES-GCM. Never stored or returned in plaintext.
						</p>
					</div>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
					>
						{submitting ? 'Adding…' : 'Add Key'}
					</button>
				</form>
			)}

			{loading ? (
				<p className="mt-8 text-neutral-500">Loading…</p>
			) : keys.length === 0 ? (
				<div className="mt-8 rounded-lg border border-neutral-800 p-12 text-center">
					<p className="text-neutral-500">No platform keys configured yet.</p>
					<p className="text-sm text-neutral-600 mt-1">
						Add one to start offering credit-based usage to users without BYOK.
					</p>
				</div>
			) : (
				<div className="mt-8 space-y-6">
					{PROVIDERS.filter((p) => grouped[p]?.length).map((p) => (
						<div key={p}>
							<h2 className="text-sm font-medium text-neutral-400 mb-2">
								{PROVIDER_LABELS[p]} · {grouped[p].length} key{grouped[p].length === 1 ? '' : 's'}
							</h2>
							<div className="rounded-lg border border-neutral-800 divide-y divide-neutral-800">
								{grouped[p].map((k) => (
									<div key={k.id} className="flex items-center justify-between p-4">
										<div>
											<p className="font-medium">{k.label || 'Default'}</p>
											<p className="text-xs text-neutral-600 mt-0.5">
												Added {new Date(k.createdAt).toLocaleDateString()} ·{' '}
												<span className={k.isActive ? 'text-green-400' : 'text-neutral-500'}>
													{k.isActive ? 'Active' : 'Disabled'}
												</span>
											</p>
										</div>
										<div className="flex items-center gap-2">
											<button
												onClick={() => handleToggle(k.id, k.isActive)}
												disabled={toggling === k.id}
												className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition disabled:opacity-50"
											>
												{toggling === k.id ? '…' : k.isActive ? 'Disable' : 'Enable'}
											</button>
											<button
												onClick={() => handleDelete(k.id)}
												disabled={deleting === k.id}
												className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
											>
												{deleting === k.id ? '…' : 'Delete'}
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

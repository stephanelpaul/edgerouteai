'use client'
import { useAuth } from '@/lib/auth-context'
import { useCallback, useEffect, useState } from 'react'

interface RoutingConfig {
	id: string
	name: string
	fallbackChain: string[]
	createdAt: string
}

export default function RoutingPage() {
	const { apiUrl, isAuthenticated } = useAuth()
	const [configs, setConfigs] = useState<RoutingConfig[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [showForm, setShowForm] = useState(false)
	const [formName, setFormName] = useState('')
	const [formChain, setFormChain] = useState('')
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState('')
	const [deleting, setDeleting] = useState<string | null>(null)

	const loadConfigs = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const r = await fetch(`${apiUrl}/api/routing`, { credentials: 'include' })
			const data = await r.json()
			if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
			setConfigs((data as any).configs ?? [])
		} catch (err: any) {
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}, [apiUrl])

	useEffect(() => {
		if (isAuthenticated) loadConfigs()
	}, [isAuthenticated, loadConfigs])

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!formName.trim() || !formChain.trim()) return
		const fallbackChain = formChain
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
		if (fallbackChain.length < 1) {
			setCreateError('Enter at least one model in the fallback chain.')
			return
		}
		setCreating(true)
		setCreateError('')
		try {
			const r = await fetch(`${apiUrl}/api/routing`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ name: formName.trim(), fallbackChain }),
			})
			const data = await r.json()
			if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
			setFormName('')
			setFormChain('')
			setShowForm(false)
			loadConfigs()
		} catch (err: any) {
			setCreateError(err.message)
		} finally {
			setCreating(false)
		}
	}

	const handleDelete = async (id: string) => {
		if (!confirm('Delete this routing config?')) return
		setDeleting(id)
		try {
			const r = await fetch(`${apiUrl}/api/routing/${id}`, {
				method: 'DELETE',
				credentials: 'include',
			})
			if (!r.ok) {
				const data = await r.json()
				throw new Error((data as any).error?.message ?? `Error ${r.status}`)
			}
			setConfigs((prev) => prev.filter((c) => c.id !== id))
		} catch (err: any) {
			setError(err.message)
		} finally {
			setDeleting(null)
		}
	}

	if (!isAuthenticated) {
		return <p className="text-neutral-500">Please sign in to access this page.</p>
	}

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Routing</h1>
					<p className="mt-1 text-neutral-400">Configure fallback chains for model routing.</p>
				</div>
				<button
					onClick={() => {
						setShowForm(!showForm)
						setCreateError('')
					}}
					className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
				>
					New Config
				</button>
			</div>

			{showForm && (
				<form
					onSubmit={handleCreate}
					className="mt-6 rounded-lg border border-neutral-800 p-6 space-y-4"
				>
					<h2 className="font-medium">New Routing Config</h2>
					<div>
						<label className="block text-sm text-neutral-400 mb-1">Name</label>
						<input
							type="text"
							value={formName}
							onChange={(e) => {
								setFormName(e.target.value)
								setCreateError('')
							}}
							placeholder="e.g. production"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
						/>
					</div>
					<div>
						<label className="block text-sm text-neutral-400 mb-1">
							Fallback chain (comma-separated model strings)
						</label>
						<input
							type="text"
							value={formChain}
							onChange={(e) => {
								setFormChain(e.target.value)
								setCreateError('')
							}}
							placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022, mistral-large-latest"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
						/>
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

			{error && <p className="mt-4 text-sm text-red-400">{error}</p>}
			{loading && <p className="mt-8 text-neutral-500">Loading...</p>}

			{!loading && configs.length === 0 && !showForm && (
				<div className="mt-8 rounded-lg border border-neutral-800 p-12 text-center">
					<p className="text-neutral-500">No routing configs yet.</p>
					<p className="text-sm text-neutral-600 mt-1">
						Create a fallback chain so requests automatically retry with a different model on
						failure.
					</p>
				</div>
			)}

			{!loading && configs.length > 0 && (
				<div className="mt-8 space-y-3">
					{configs.map((config) => (
						<div
							key={config.id}
							className="flex items-start justify-between rounded-lg border border-neutral-800 p-4"
						>
							<div>
								<p className="font-medium">{config.name}</p>
								<p className="mt-1 text-sm text-neutral-500">
									Chain: {(config.fallbackChain ?? []).join(' → ')}
								</p>
								<p className="text-xs text-neutral-600 mt-0.5">
									Created {new Date(config.createdAt).toLocaleDateString()}
								</p>
							</div>
							<button
								onClick={() => handleDelete(config.id)}
								disabled={deleting === config.id}
								className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
							>
								{deleting === config.id ? 'Deleting...' : 'Delete'}
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

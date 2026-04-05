'use client'
import { useAuth } from '@/lib/auth-context'
import { useCallback, useEffect, useState } from 'react'

interface ModelAlias {
	id: string
	alias: string
	targetModel: string
	createdAt: string
}

const AVAILABLE_MODELS = [
	{ value: 'openai/gpt-5.4', label: 'GPT-5.4 (OpenAI)' },
	{ value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 Mini (OpenAI)' },
	{ value: 'openai/gpt-5.2', label: 'GPT-5.2 (OpenAI)' },
	{ value: 'openai/gpt-5', label: 'GPT-5 (OpenAI)' },
	{ value: 'openai/gpt-4o', label: 'GPT-4o (OpenAI)' },
	{ value: 'openai/gpt-4.1', label: 'GPT-4.1 (OpenAI)' },
	{ value: 'openai/o3', label: 'o3 (OpenAI)' },
	{ value: 'openai/o4-mini', label: 'o4-mini (OpenAI)' },
	{ value: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6 (Anthropic)' },
	{ value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Anthropic)' },
	{ value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Anthropic)' },
	{ value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5 (Anthropic)' },
	{ value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Google)' },
	{ value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google)' },
	{ value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Google)' },
	{ value: 'mistral/mistral-large', label: 'Mistral Large 3 (Mistral)' },
	{ value: 'mistral/mistral-medium', label: 'Mistral Medium 3 (Mistral)' },
	{ value: 'mistral/mistral-small', label: 'Mistral Small 3.1 (Mistral)' },
	{ value: 'xai/grok-4.20', label: 'Grok 4.20 (xAI)' },
]

export default function AliasesPage() {
	const { apiUrl, isAuthenticated } = useAuth()
	const [aliases, setAliases] = useState<ModelAlias[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [showForm, setShowForm] = useState(false)
	const [aliasName, setAliasName] = useState('')
	const [targetModel, setTargetModel] = useState(AVAILABLE_MODELS[0].value)
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState('')
	const [deleting, setDeleting] = useState<string | null>(null)

	const loadAliases = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const r = await fetch(`${apiUrl}/api/aliases`, { credentials: 'include' })
			const data = await r.json()
			const d = data as { error?: { message?: string }; aliases?: ModelAlias[] }
			if (!r.ok) throw new Error(d.error?.message ?? `Error ${r.status}`)
			setAliases(d.aliases ?? [])
		} catch (err) {
			setError((err as { message?: string }).message ?? 'Failed to load aliases')
		} finally {
			setLoading(false)
		}
	}, [apiUrl])

	useEffect(() => {
		if (isAuthenticated) loadAliases()
	}, [isAuthenticated, loadAliases])

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!aliasName.trim()) return
		setCreating(true)
		setCreateError('')
		try {
			const r = await fetch(`${apiUrl}/api/aliases`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ alias: aliasName.trim(), targetModel }),
			})
			const data = await r.json()
			const d = data as { error?: { message?: string } }
			if (!r.ok) throw new Error(d.error?.message ?? `Error ${r.status}`)
			setAliasName('')
			setTargetModel(AVAILABLE_MODELS[0].value)
			setShowForm(false)
			loadAliases()
		} catch (err) {
			setCreateError((err as { message?: string }).message ?? 'Failed to create alias')
		} finally {
			setCreating(false)
		}
	}

	const handleDelete = async (id: string) => {
		if (!confirm('Delete this alias? This cannot be undone.')) return
		setDeleting(id)
		try {
			const r = await fetch(`${apiUrl}/api/aliases/${id}`, {
				method: 'DELETE',
				credentials: 'include',
			})
			if (!r.ok) {
				const data = await r.json()
				const d = data as { error?: { message?: string } }
				throw new Error(d.error?.message ?? `Error ${r.status}`)
			}
			setAliases((prev) => prev.filter((a) => a.id !== id))
		} catch (err) {
			setError((err as { message?: string }).message ?? 'Failed to delete alias')
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
					<h1 className="text-2xl font-bold">Model Aliases</h1>
					<p className="mt-1 text-neutral-400">
						Create short names that map to full model identifiers. Use the alias in your API calls.
					</p>
				</div>
				<button
					type="button"
					onClick={() => {
						setShowForm(!showForm)
						setCreateError('')
					}}
					className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
				>
					Create Alias
				</button>
			</div>

			{showForm && (
				<form
					onSubmit={handleCreate}
					className="mt-6 rounded-lg border border-neutral-800 p-6 space-y-4"
				>
					<h2 className="font-medium">New Model Alias</h2>
					<div>
						<label className="block text-sm text-neutral-400 mb-1">Alias name</label>
						<input
							type="text"
							value={aliasName}
							onChange={(e) => {
								setAliasName(e.target.value)
								setCreateError('')
							}}
							placeholder="e.g. my-fast, production-llm"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
						/>
					</div>
					<div>
						<label className="block text-sm text-neutral-400 mb-1">Target model</label>
						<select
							value={targetModel}
							onChange={(e) => setTargetModel(e.target.value)}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
						>
							{AVAILABLE_MODELS.map((m) => (
								<option key={m.value} value={m.value}>
									{m.label}
								</option>
							))}
						</select>
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

			{!loading && aliases.length === 0 && !showForm && (
				<div className="mt-8 rounded-lg border border-neutral-800 p-12 text-center">
					<p className="text-neutral-500">No model aliases yet.</p>
					<p className="text-sm text-neutral-600 mt-1">
						Create an alias to use short names like &quot;my-fast&quot; instead of full model
						identifiers.
					</p>
				</div>
			)}

			{!loading && aliases.length > 0 && (
				<div className="mt-8 overflow-hidden rounded-lg border border-neutral-800">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-neutral-800 bg-neutral-900/50">
								<th className="px-4 py-3 text-left font-medium text-neutral-400">Alias</th>
								<th className="px-4 py-3 text-left font-medium text-neutral-400">Target Model</th>
								<th className="px-4 py-3 text-left font-medium text-neutral-400">Created</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{aliases.map((alias) => (
								<tr key={alias.id} className="border-b border-neutral-800 last:border-0">
									<td className="px-4 py-3 font-mono text-purple-300">{alias.alias}</td>
									<td className="px-4 py-3 text-neutral-300">{alias.targetModel}</td>
									<td className="px-4 py-3 text-neutral-500">
										{new Date(alias.createdAt).toLocaleDateString()}
									</td>
									<td className="px-4 py-3 text-right">
										<button
											onClick={() => handleDelete(alias.id)}
											disabled={deleting === alias.id}
											className="rounded-md border border-red-900 px-3 py-1 text-xs text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
										>
											{deleting === alias.id ? 'Deleting...' : 'Delete'}
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

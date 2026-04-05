'use client'
import { useAuth } from '@/lib/auth-context'
import { useCallback, useEffect, useState } from 'react'

interface Webhook {
	id: string
	url: string
	events: string
	isActive: boolean
	createdAt: number
}

const EVENT_OPTIONS = [
	{
		value: 'request.completed',
		label: 'Request Completed',
		description: 'Fired after every successful request with usage data',
	},
	{
		value: 'budget.exceeded',
		label: 'Budget Exceeded',
		description: 'Fired when a monthly budget limit is hit',
	},
]

export default function WebhooksPage() {
	const { apiUrl, isAuthenticated } = useAuth()
	const [webhooks, setWebhooks] = useState<Webhook[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [showForm, setShowForm] = useState(false)
	const [url, setUrl] = useState('')
	const [selectedEvents, setSelectedEvents] = useState<string[]>(['request.completed'])
	const [secret, setSecret] = useState('')
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState('')
	const [testing, setTesting] = useState<string | null>(null)
	const [testResult, setTestResult] = useState<{
		id: string
		success: boolean
		message: string
	} | null>(null)
	const [toggling, setToggling] = useState<string | null>(null)
	const [deleting, setDeleting] = useState<string | null>(null)

	const loadWebhooks = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const res = await fetch(`${apiUrl}/api/webhooks`, { credentials: 'include' })
			const data = await res.json()
			if (!res.ok) throw new Error((data as any).error?.message ?? `Error ${res.status}`)
			setWebhooks((data as any).webhooks ?? [])
		} catch (err: any) {
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}, [apiUrl])

	useEffect(() => {
		if (isAuthenticated) loadWebhooks()
	}, [isAuthenticated, loadWebhooks])

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!url.trim() || selectedEvents.length === 0) return
		setCreating(true)
		setCreateError('')
		try {
			const r = await fetch(`${apiUrl}/api/webhooks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					url: url.trim(),
					events: selectedEvents,
					secret: secret.trim() || undefined,
				}),
			})
			const data = await r.json()
			if (!r.ok) throw new Error((data as any).error?.message ?? `Error ${r.status}`)
			setUrl('')
			setSecret('')
			setSelectedEvents(['request.completed'])
			setShowForm(false)
			loadWebhooks()
		} catch (err: any) {
			setCreateError(err.message)
		} finally {
			setCreating(false)
		}
	}

	const handleToggle = async (wh: Webhook) => {
		setToggling(wh.id)
		try {
			const r = await fetch(`${apiUrl}/api/webhooks/${wh.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ isActive: !wh.isActive }),
			})
			if (!r.ok) {
				const data = await r.json()
				throw new Error((data as any).error?.message ?? `Error ${r.status}`)
			}
			setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? { ...w, isActive: !w.isActive } : w)))
		} catch (err: any) {
			setError(err.message)
		} finally {
			setToggling(null)
		}
	}

	const handleDelete = async (id: string) => {
		if (!confirm('Delete this webhook?')) return
		setDeleting(id)
		try {
			const r = await fetch(`${apiUrl}/api/webhooks/${id}`, {
				method: 'DELETE',
				credentials: 'include',
			})
			if (!r.ok) {
				const data = await r.json()
				throw new Error((data as any).error?.message ?? `Error ${r.status}`)
			}
			setWebhooks((prev) => prev.filter((w) => w.id !== id))
		} catch (err: any) {
			setError(err.message)
		} finally {
			setDeleting(null)
		}
	}

	const handleTest = async (id: string) => {
		setTesting(id)
		setTestResult(null)
		try {
			const r = await fetch(`${apiUrl}/api/webhooks/${id}/test`, {
				method: 'POST',
				credentials: 'include',
			})
			const data = await r.json()
			setTestResult({
				id,
				success: (data as any).success,
				message: (data as any).success
					? `Test delivered (HTTP ${(data as any).statusCode})`
					: `Failed: ${(data as any).error ?? 'Unknown error'}`,
			})
		} catch (err: any) {
			setTestResult({ id, success: false, message: err.message })
		} finally {
			setTesting(null)
		}
	}

	const toggleEvent = (evt: string) => {
		setSelectedEvents((prev) =>
			prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt],
		)
	}

	if (!isAuthenticated) {
		return <p className="text-neutral-500">Please sign in to access this page.</p>
	}

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Webhooks</h1>
					<p className="mt-1 text-neutral-400">
						Receive real-time events when requests complete or budgets are exceeded.
					</p>
				</div>
				<button
					onClick={() => {
						setShowForm(!showForm)
						setCreateError('')
					}}
					className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
				>
					Add Webhook
				</button>
			</div>

			{showForm && (
				<form
					onSubmit={handleCreate}
					className="mt-6 rounded-lg border border-neutral-800 p-6 space-y-5"
				>
					<h2 className="font-medium">New Webhook</h2>

					<div>
						<label className="block text-sm text-neutral-400 mb-1.5">Endpoint URL</label>
						<input
							type="url"
							value={url}
							onChange={(e) => {
								setUrl(e.target.value)
								setCreateError('')
							}}
							placeholder="https://your-server.com/webhook"
							required
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
						/>
					</div>

					<div>
						<label className="block text-sm text-neutral-400 mb-2">Events</label>
						<div className="space-y-2">
							{EVENT_OPTIONS.map((evt) => (
								<label key={evt.value} className="flex items-start gap-3 cursor-pointer group">
									<input
										type="checkbox"
										checked={selectedEvents.includes(evt.value)}
										onChange={() => toggleEvent(evt.value)}
										className="mt-0.5 accent-purple-600"
									/>
									<div>
										<p className="text-sm font-medium group-hover:text-white transition">
											{evt.label}
										</p>
										<p className="text-xs text-neutral-500">{evt.description}</p>
									</div>
								</label>
							))}
						</div>
					</div>

					<div>
						<label className="block text-sm text-neutral-400 mb-1.5">
							Signing Secret <span className="text-neutral-600">(optional)</span>
						</label>
						<input
							type="text"
							value={secret}
							onChange={(e) => setSecret(e.target.value)}
							placeholder="Used to sign payloads via X-EdgeRoute-Signature"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none font-mono"
						/>
					</div>

					{createError && <p className="text-sm text-red-400">{createError}</p>}

					<div className="flex gap-3">
						<button
							type="submit"
							disabled={creating || selectedEvents.length === 0}
							className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-50"
						>
							{creating ? 'Creating...' : 'Create Webhook'}
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

			{!loading && webhooks.length === 0 && !showForm && (
				<div className="mt-8 rounded-lg border border-neutral-800 p-12 text-center">
					<p className="text-neutral-500">No webhooks configured.</p>
					<p className="text-sm text-neutral-600 mt-1">
						Add a webhook to receive events from EdgeRouteAI.
					</p>
				</div>
			)}

			{!loading && webhooks.length > 0 && (
				<div className="mt-8 space-y-3">
					{webhooks.map((wh) => {
						const events: string[] = JSON.parse(wh.events)
						const result = testResult?.id === wh.id ? testResult : null
						return (
							<div key={wh.id} className="rounded-lg border border-neutral-800 p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 flex-wrap">
											<p className="font-mono text-sm truncate">{wh.url}</p>
											<span
												className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
													wh.isActive
														? 'bg-green-950/40 text-green-400'
														: 'bg-neutral-800 text-neutral-500'
												}`}
											>
												{wh.isActive ? 'Active' : 'Inactive'}
											</span>
										</div>
										<div className="mt-1.5 flex flex-wrap gap-1.5">
											{events.map((evt) => (
												<span
													key={evt}
													className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono"
												>
													{evt}
												</span>
											))}
										</div>
										<p className="mt-1.5 text-xs text-neutral-600">
											Created {new Date(wh.createdAt).toLocaleDateString()}
										</p>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<button
											onClick={() => handleTest(wh.id)}
											disabled={testing === wh.id}
											className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition disabled:opacity-50"
										>
											{testing === wh.id ? 'Testing...' : 'Test'}
										</button>
										<button
											onClick={() => handleToggle(wh)}
											disabled={toggling === wh.id}
											className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition disabled:opacity-50"
										>
											{toggling === wh.id ? '...' : wh.isActive ? 'Disable' : 'Enable'}
										</button>
										<button
											onClick={() => handleDelete(wh.id)}
											disabled={deleting === wh.id}
											className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30 transition disabled:opacity-50"
										>
											{deleting === wh.id ? 'Deleting...' : 'Delete'}
										</button>
									</div>
								</div>
								{result && (
									<div
										className={`mt-3 pt-3 border-t border-neutral-800 text-sm ${
											result.success ? 'text-green-400' : 'text-red-400'
										}`}
									>
										{result.message}
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

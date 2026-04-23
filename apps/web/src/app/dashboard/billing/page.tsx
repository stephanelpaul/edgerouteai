'use client'
import { useAuth } from '@/lib/auth-context'
import { useCallback, useEffect, useState } from 'react'

const BILLING_URL =
	process.env.NEXT_PUBLIC_BILLING_URL ?? 'https://edgerouteai-billing.remediumdev.workers.dev'

const PACK_SIZES = [5, 20, 50, 100] as const

interface Balance {
	balanceCents: number
	lifetimeToppedUpCents: number
	lifetimeSpentCents: number
}

interface LedgerEntry {
	id: string
	requestLogId: string
	costCents: number
	markupCents: number
	totalDebitedCents: number
	createdAt: number
}

function dollars(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}

export default function BillingPage() {
	const { isAuthenticated } = useAuth()
	const [balance, setBalance] = useState<Balance | null>(null)
	const [history, setHistory] = useState<LedgerEntry[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [topUpPending, setTopUpPending] = useState<number | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const [balRes, histRes] = await Promise.all([
				fetch(`${BILLING_URL}/balance`, { credentials: 'include' }),
				fetch(`${BILLING_URL}/balance/history`, { credentials: 'include' }),
			])
			const balData = (await balRes.json()) as Balance & { error?: { message?: string } }
			if (!balRes.ok) throw new Error(balData.error?.message ?? `Error ${balRes.status}`)
			const histData = (await histRes.json()) as { entries?: LedgerEntry[] }
			setBalance(balData)
			setHistory(histData.entries ?? [])
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Failed to load')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		if (isAuthenticated) load()
	}, [isAuthenticated, load])

	const handleTopUp = async (packUsd: number) => {
		setTopUpPending(packUsd)
		setError('')
		try {
			const res = await fetch(`${BILLING_URL}/checkout`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ packUsd }),
			})
			const data = (await res.json()) as { url?: string; error?: { message?: string } }
			if (!res.ok) throw new Error(data.error?.message ?? `Error ${res.status}`)
			if (data.url) window.location.href = data.url
			else throw new Error('Checkout URL missing from response')
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Top-up failed')
			setTopUpPending(null)
		}
	}

	if (!isAuthenticated) {
		return <p className="text-neutral-500">Please sign in to access billing.</p>
	}

	return (
		<div>
			<div>
				<h1 className="text-2xl font-bold">Billing & Credits</h1>
				<p className="mt-1 text-neutral-400">
					Top up your balance to use platform-managed keys. BYOK (your own keys) is zero-markup and
					doesn&apos;t need credits.
				</p>
			</div>

			{error && (
				<div className="mt-6 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
					{error}
				</div>
			)}

			<div className="mt-8 grid gap-6 md:grid-cols-3">
				<div className="rounded-lg border border-neutral-800 p-6">
					<p className="text-sm text-neutral-500">Current balance</p>
					<p className="mt-2 text-3xl font-semibold">
						{balance ? dollars(balance.balanceCents) : '—'}
					</p>
				</div>
				<div className="rounded-lg border border-neutral-800 p-6">
					<p className="text-sm text-neutral-500">Lifetime topped up</p>
					<p className="mt-2 text-3xl font-semibold">
						{balance ? dollars(balance.lifetimeToppedUpCents) : '—'}
					</p>
				</div>
				<div className="rounded-lg border border-neutral-800 p-6">
					<p className="text-sm text-neutral-500">Lifetime spent</p>
					<p className="mt-2 text-3xl font-semibold">
						{balance ? dollars(balance.lifetimeSpentCents) : '—'}
					</p>
				</div>
			</div>

			<div className="mt-10">
				<h2 className="text-lg font-medium">Add credits</h2>
				<p className="mt-1 text-sm text-neutral-500">
					Credits never expire. 2.5% markup is applied on platform-key requests; BYOK has no markup.
				</p>
				<div className="mt-4 grid gap-3 sm:grid-cols-4">
					{PACK_SIZES.map((pack) => (
						<button
							key={pack}
							onClick={() => handleTopUp(pack)}
							disabled={topUpPending !== null}
							className="rounded-lg border border-neutral-700 bg-neutral-900 px-5 py-6 text-center hover:border-purple-500 transition disabled:opacity-50"
						>
							<p className="text-2xl font-semibold">${pack}</p>
							<p className="mt-1 text-xs text-neutral-500">
								{topUpPending === pack ? 'Redirecting…' : 'Add credits'}
							</p>
						</button>
					))}
				</div>
			</div>

			<div className="mt-10">
				<h2 className="text-lg font-medium">Recent usage</h2>
				{loading ? (
					<p className="mt-4 text-neutral-500">Loading…</p>
				) : history.length === 0 ? (
					<p className="mt-4 text-sm text-neutral-500">
						No platform-key usage yet. Top up and make a request.
					</p>
				) : (
					<div className="mt-4 overflow-x-auto rounded-lg border border-neutral-800">
						<table className="w-full text-sm">
							<thead className="bg-neutral-900 text-left text-neutral-400">
								<tr>
									<th className="px-4 py-2 font-medium">When</th>
									<th className="px-4 py-2 font-medium">Provider cost</th>
									<th className="px-4 py-2 font-medium">Markup (2.5%)</th>
									<th className="px-4 py-2 font-medium">Total debited</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800">
								{history.map((row) => (
									<tr key={row.id}>
										<td className="px-4 py-2 text-neutral-300">
											{new Date(row.createdAt).toLocaleString()}
										</td>
										<td className="px-4 py-2 text-neutral-300">{dollars(row.costCents)}</td>
										<td className="px-4 py-2 text-neutral-300">{dollars(row.markupCents)}</td>
										<td className="px-4 py-2 text-neutral-300">{dollars(row.totalDebitedCents)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	)
}

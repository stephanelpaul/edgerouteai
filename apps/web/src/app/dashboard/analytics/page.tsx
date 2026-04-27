'use client'
import { useAuth } from '@/lib/auth-context'
import { useCallback, useEffect, useState } from 'react'
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts'

interface LatencyRow {
	provider: string
	model: string
	count: number
	avgMs: number
	p50Ms: number
	p95Ms: number
	p99Ms: number
}

interface CostRow {
	day: string
	provider: string
	requests: number
	costUsd: number
}

interface ErrorRow {
	provider: string
	total: number
	errors: number
	errorRate: number
}

interface TopModelRow {
	provider: string
	model: string
	requests: number
	inputTokens: number
	outputTokens: number
	costUsd: number
}

const PROVIDER_COLORS: Record<string, string> = {
	openai: '#10b981',
	anthropic: '#f59e0b',
	google: '#3b82f6',
	mistral: '#ef4444',
	xai: '#8b5cf6',
	groq: '#ec4899',
	together: '#06b6d4',
	cloudflare: '#f97316',
	cohere: '#22d3ee',
	ollama: '#a3e635',
	azure: '#6366f1',
}

function colorFor(provider: string): string {
	return PROVIDER_COLORS[provider] ?? '#737373'
}

export default function AnalyticsPage() {
	const { apiUrl, isAuthenticated } = useAuth()
	const [latency, setLatency] = useState<LatencyRow[]>([])
	const [cost, setCost] = useState<CostRow[]>([])
	const [errors, setErrors] = useState<ErrorRow[]>([])
	const [top, setTop] = useState<TopModelRow[]>([])
	const [loading, setLoading] = useState(false)
	const [days, setDays] = useState(7)
	const [error, setError] = useState('')

	const load = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const [latRes, costRes, errRes, topRes] = await Promise.all([
				fetch(`${apiUrl}/api/analytics/latency?days=${days}`, { credentials: 'include' }),
				fetch(`${apiUrl}/api/analytics/cost-daily?days=${days}`, { credentials: 'include' }),
				fetch(`${apiUrl}/api/analytics/errors?days=${days}`, { credentials: 'include' }),
				fetch(`${apiUrl}/api/analytics/top-models?days=${days}&limit=10`, {
					credentials: 'include',
				}),
			])
			const [latData, costData, errData, topData] = await Promise.all([
				latRes.json(),
				costRes.json(),
				errRes.json(),
				topRes.json(),
			])
			setLatency((latData as { rows: LatencyRow[] }).rows ?? [])
			setCost((costData as { rows: CostRow[] }).rows ?? [])
			setErrors((errData as { rows: ErrorRow[] }).rows ?? [])
			setTop((topData as { rows: TopModelRow[] }).rows ?? [])
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Failed to load analytics')
		} finally {
			setLoading(false)
		}
	}, [apiUrl, days])

	useEffect(() => {
		if (isAuthenticated) load()
	}, [isAuthenticated, load])

	// Pivot cost rows into a wide format for stacked-area chart: one row per
	// day, one column per provider.
	const costByDay = (() => {
		const days = new Map<string, Record<string, number | string>>()
		const providers = new Set<string>()
		for (const r of cost) {
			providers.add(r.provider)
			const row = days.get(r.day) ?? { day: r.day }
			row[r.provider] = (Number(row[r.provider]) || 0) + Number(r.costUsd)
			days.set(r.day, row)
		}
		return { rows: [...days.values()], providers: [...providers] }
	})()

	if (!isAuthenticated) return <p className="text-neutral-500">Please sign in.</p>

	return (
		<div>
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold">Analytics</h1>
					<p className="mt-1 text-neutral-400">
						Latency percentiles, cost over time, error rates, and top models.
					</p>
				</div>
				<div className="flex gap-2">
					{[1, 7, 30, 90].map((d) => (
						<button
							key={d}
							onClick={() => setDays(d)}
							className={`rounded-md border px-3 py-1.5 text-sm transition ${
								days === d
									? 'border-purple-500 bg-purple-500/10 text-purple-300'
									: 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
							}`}
						>
							{d}d
						</button>
					))}
				</div>
			</div>

			{error && (
				<div className="mt-6 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
					{error}
				</div>
			)}

			{loading && <p className="mt-8 text-neutral-500">Loading…</p>}

			{!loading && !error && (
				<>
					{/* Cost over time */}
					<section className="mt-8">
						<h2 className="text-lg font-medium mb-3">Cost over time</h2>
						{costByDay.rows.length === 0 ? (
							<p className="text-sm text-neutral-500">No data in this window.</p>
						) : (
							<div className="rounded-lg border border-neutral-800 p-4 h-72">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={costByDay.rows}>
										<CartesianGrid strokeDasharray="3 3" stroke="#262626" />
										<XAxis dataKey="day" stroke="#737373" fontSize={11} />
										<YAxis
											stroke="#737373"
											fontSize={11}
											tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
										/>
										<Tooltip
											contentStyle={{
												background: '#0a0a0a',
												border: '1px solid #262626',
												borderRadius: 6,
												fontSize: 12,
											}}
											formatter={(v: number) => `$${v.toFixed(4)}`}
										/>
										<Legend wrapperStyle={{ fontSize: 11 }} />
										{costByDay.providers.map((p) => (
											<Bar key={p} dataKey={p} stackId="cost" fill={colorFor(p)} />
										))}
									</BarChart>
								</ResponsiveContainer>
							</div>
						)}
					</section>

					{/* Latency table */}
					<section className="mt-10">
						<h2 className="text-lg font-medium mb-3">Latency by model</h2>
						{latency.length === 0 ? (
							<p className="text-sm text-neutral-500">No requests in this window.</p>
						) : (
							<div className="overflow-x-auto rounded-lg border border-neutral-800">
								<table className="w-full text-sm">
									<thead className="bg-neutral-900 text-left text-neutral-400">
										<tr>
											<th className="px-4 py-2 font-medium">Model</th>
											<th className="px-4 py-2 font-medium text-right">Requests</th>
											<th className="px-4 py-2 font-medium text-right">Avg</th>
											<th className="px-4 py-2 font-medium text-right">p50</th>
											<th className="px-4 py-2 font-medium text-right">p95</th>
											<th className="px-4 py-2 font-medium text-right">p99</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-neutral-800">
										{latency.map((r) => (
											<tr key={`${r.provider}/${r.model}`}>
												<td className="px-4 py-2">
													<span
														className="inline-block w-2 h-2 rounded-full mr-2"
														style={{ background: colorFor(r.provider) }}
													/>
													<span className="text-neutral-300">
														{r.provider}/{r.model}
													</span>
												</td>
												<td className="px-4 py-2 text-right text-neutral-300">{r.count}</td>
												<td className="px-4 py-2 text-right text-neutral-300">{r.avgMs}ms</td>
												<td className="px-4 py-2 text-right text-neutral-300">{r.p50Ms}ms</td>
												<td className="px-4 py-2 text-right text-neutral-300">{r.p95Ms}ms</td>
												<td className="px-4 py-2 text-right text-neutral-300">{r.p99Ms}ms</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>

					{/* Error rate */}
					<section className="mt-10">
						<h2 className="text-lg font-medium mb-3">Error rate by provider</h2>
						{errors.length === 0 ? (
							<p className="text-sm text-neutral-500">No data.</p>
						) : (
							<div className="rounded-lg border border-neutral-800 p-4 h-64">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={errors}>
										<CartesianGrid strokeDasharray="3 3" stroke="#262626" />
										<XAxis dataKey="provider" stroke="#737373" fontSize={11} />
										<YAxis
											stroke="#737373"
											fontSize={11}
											domain={[0, 1]}
											tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
										/>
										<Tooltip
											contentStyle={{
												background: '#0a0a0a',
												border: '1px solid #262626',
												borderRadius: 6,
												fontSize: 12,
											}}
											formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
										/>
										<Line
											type="monotone"
											dataKey="errorRate"
											stroke="#ef4444"
											strokeWidth={2}
											dot={({ cx, cy, payload }) => (
												<circle cx={cx} cy={cy} r={4} fill={colorFor(payload.provider)} />
											)}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						)}
					</section>

					{/* Top models */}
					<section className="mt-10 mb-8">
						<h2 className="text-lg font-medium mb-3">Top models by usage</h2>
						{top.length === 0 ? (
							<p className="text-sm text-neutral-500">No data.</p>
						) : (
							<div className="rounded-lg border border-neutral-800 p-4 h-72">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={top.map((r) => ({
											name: `${r.provider}/${r.model}`.slice(0, 28),
											provider: r.provider,
											requests: r.requests,
										}))}
										layout="vertical"
									>
										<CartesianGrid strokeDasharray="3 3" stroke="#262626" />
										<XAxis type="number" stroke="#737373" fontSize={11} />
										<YAxis
											dataKey="name"
											type="category"
											stroke="#737373"
											fontSize={11}
											width={200}
										/>
										<Tooltip
											contentStyle={{
												background: '#0a0a0a',
												border: '1px solid #262626',
												borderRadius: 6,
												fontSize: 12,
											}}
										/>
										<Bar dataKey="requests">
											{top.map((r) => (
												<Cell key={`${r.provider}/${r.model}`} fill={colorFor(r.provider)} />
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						)}
					</section>
				</>
			)}
		</div>
	)
}

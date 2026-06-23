import { createDb, requestLogs } from '@edgerouteai/db'
import { and, eq, gte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppContext } from '../lib/env.js'

// Observability endpoints. Distinct from /api/stats (which returns a single
// summary card row) — these power the dashboard analytics page with
// per-model latency percentiles, daily cost breakdowns, and error rates.

const analyticsRoute = new Hono<AppContext>()

function rangeFilter(days: number) {
	const since = new Date(Date.now() - days * 86_400_000)
	return since
}

/**
 * GET /api/analytics/latency?days=N
 * Returns p50 / p95 / p99 / avg latency per (provider, model) for the
 * window. SQLite doesn't have percentile_cont, so we compute approximate
 * percentiles from the sorted latency list per group.
 */
analyticsRoute.get('/latency', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const days = Number(c.req.query('days') ?? 7)
	const since = rangeFilter(days)

	// Fetch all latencies grouped by (provider, model) since `since`.
	const rows = await db
		.select({
			provider: requestLogs.provider,
			model: requestLogs.model,
			latencyMs: requestLogs.latencyMs,
			statusCode: requestLogs.statusCode,
		})
		.from(requestLogs)
		.where(and(eq(requestLogs.userId, userId), gte(requestLogs.createdAt, since)))
		.limit(10_000)

	// Bucket by `${provider}/${model}`, compute percentiles.
	const buckets = new Map<string, number[]>()
	for (const r of rows) {
		if (r.statusCode < 200 || r.statusCode >= 300) continue
		if (r.latencyMs == null) continue
		const key = `${r.provider}/${r.model}`
		const arr = buckets.get(key) ?? []
		arr.push(r.latencyMs)
		buckets.set(key, arr)
	}

	const out = [...buckets.entries()].map(([key, latencies]) => {
		latencies.sort((a, b) => a - b)
		const n = latencies.length
		const pick = (p: number) => latencies[Math.min(n - 1, Math.floor(p * n))] ?? 0
		const sum = latencies.reduce((a, b) => a + b, 0)
		const [provider, ...modelParts] = key.split('/')
		return {
			provider,
			model: modelParts.join('/'),
			count: n,
			avgMs: n === 0 ? 0 : Math.round(sum / n),
			p50Ms: pick(0.5),
			p95Ms: pick(0.95),
			p99Ms: pick(0.99),
		}
	})
	out.sort((a, b) => b.count - a.count)
	return c.json({ days, rows: out })
})

/**
 * GET /api/analytics/cost-daily?days=N
 * One row per UTC calendar day. Useful for charting cost over time.
 */
analyticsRoute.get('/cost-daily', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const days = Number(c.req.query('days') ?? 30)
	const since = rangeFilter(days)

	const rows = await db
		.select({
			day: sql<string>`strftime('%Y-%m-%d', ${requestLogs.createdAt} / 1000, 'unixepoch')`,
			provider: requestLogs.provider,
			requests: sql<number>`count(*)`,
			costUsd: sql<number>`coalesce(sum(${requestLogs.costUsd}), 0)`,
		})
		.from(requestLogs)
		.where(and(eq(requestLogs.userId, userId), gte(requestLogs.createdAt, since)))
		.groupBy(
			sql`strftime('%Y-%m-%d', ${requestLogs.createdAt} / 1000, 'unixepoch')`,
			requestLogs.provider,
		)
		.orderBy(sql`strftime('%Y-%m-%d', ${requestLogs.createdAt} / 1000, 'unixepoch')`)

	return c.json({ days, rows })
})

/**
 * GET /api/analytics/errors?days=N
 * Error rate by provider. Counts non-2xx status codes.
 */
analyticsRoute.get('/errors', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const days = Number(c.req.query('days') ?? 7)
	const since = rangeFilter(days)

	const rows = await db
		.select({
			provider: requestLogs.provider,
			total: sql<number>`count(*)`,
			errors: sql<number>`sum(case when ${requestLogs.statusCode} >= 400 then 1 else 0 end)`,
		})
		.from(requestLogs)
		.where(and(eq(requestLogs.userId, userId), gte(requestLogs.createdAt, since)))
		.groupBy(requestLogs.provider)

	const out = rows.map((r) => ({
		provider: r.provider,
		total: r.total,
		errors: r.errors,
		errorRate: r.total === 0 ? 0 : r.errors / r.total,
	}))
	return c.json({ days, rows: out })
})

/**
 * GET /api/analytics/top-models?days=N&limit=10
 * Most-used models by request count.
 */
analyticsRoute.get('/top-models', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const days = Number(c.req.query('days') ?? 7)
	const limit = Math.min(50, Number(c.req.query('limit') ?? 10))
	const since = rangeFilter(days)

	const rows = await db
		.select({
			provider: requestLogs.provider,
			model: requestLogs.model,
			requests: sql<number>`count(*)`,
			inputTokens: sql<number>`coalesce(sum(${requestLogs.inputTokens}), 0)`,
			outputTokens: sql<number>`coalesce(sum(${requestLogs.outputTokens}), 0)`,
			costUsd: sql<number>`coalesce(sum(${requestLogs.costUsd}), 0)`,
		})
		.from(requestLogs)
		.where(and(eq(requestLogs.userId, userId), gte(requestLogs.createdAt, since)))
		.groupBy(requestLogs.provider, requestLogs.model)
		.orderBy(sql`count(*) desc`)
		.limit(limit)

	return c.json({ days, rows })
})

export { analyticsRoute }

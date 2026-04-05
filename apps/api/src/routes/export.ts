import { Hono } from 'hono'
import { eq, gte, sql } from 'drizzle-orm'
import { createDb, requestLogs } from '@edgerouteai/db'
import type { AppContext } from '../lib/env.js'

const exportRoute = new Hono<AppContext>()

exportRoute.get('/logs', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const format = c.req.query('format') ?? 'csv'
  const days = Number(c.req.query('days') ?? 30)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const logs = await db
    .select()
    .from(requestLogs)
    .where(eq(requestLogs.userId, userId))
    .orderBy(requestLogs.createdAt)

  const filtered = logs.filter((l) => new Date(l.createdAt) >= since)

  if (format === 'json') {
    const json = JSON.stringify(
      filtered.map((l) => ({
        timestamp: new Date(l.createdAt).toISOString(),
        provider: l.provider,
        model: l.model,
        input_tokens: l.inputTokens ?? 0,
        output_tokens: l.outputTokens ?? 0,
        cost_usd: l.costUsd ?? 0,
        latency_ms: l.latencyMs ?? 0,
        status_code: l.statusCode,
      })),
      null,
      2,
    )
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="edgeroute-logs-${days}d.json"`,
      },
    })
  }

  // CSV format
  const header = 'timestamp,provider,model,input_tokens,output_tokens,cost_usd,latency_ms,status_code'
  const rows = filtered.map((l) => {
    const ts = new Date(l.createdAt).toISOString()
    return `${ts},${l.provider},${l.model},${l.inputTokens ?? 0},${l.outputTokens ?? 0},${(l.costUsd ?? 0).toFixed(8)},${l.latencyMs ?? 0},${l.statusCode}`
  })
  const csv = [header, ...rows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="edgeroute-logs-${days}d.csv"`,
    },
  })
})

exportRoute.get('/stats', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const format = c.req.query('format') ?? 'csv'
  const days = Number(c.req.query('days') ?? 30)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const logs = await db
    .select()
    .from(requestLogs)
    .where(eq(requestLogs.userId, userId))

  const filtered = logs.filter((l) => new Date(l.createdAt) >= since)

  // Aggregate by date
  const byDate: Record<string, { requests: number; inputTokens: number; outputTokens: number; costUsd: number; totalLatency: number }> = {}

  for (const l of filtered) {
    const date = new Date(l.createdAt).toISOString().slice(0, 10)
    if (!byDate[date]) byDate[date] = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, totalLatency: 0 }
    byDate[date].requests++
    byDate[date].inputTokens += l.inputTokens ?? 0
    byDate[date].outputTokens += l.outputTokens ?? 0
    byDate[date].costUsd += l.costUsd ?? 0
    byDate[date].totalLatency += l.latencyMs ?? 0
  }

  const stats = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      requests: v.requests,
      input_tokens: v.inputTokens,
      output_tokens: v.outputTokens,
      cost_usd: v.costUsd,
      avg_latency_ms: v.requests > 0 ? Math.round(v.totalLatency / v.requests) : 0,
    }))

  if (format === 'json') {
    const json = JSON.stringify(stats, null, 2)
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="edgeroute-stats-${days}d.json"`,
      },
    })
  }

  const header = 'date,requests,input_tokens,output_tokens,cost_usd,avg_latency_ms'
  const rows = stats.map((s) =>
    `${s.date},${s.requests},${s.input_tokens},${s.output_tokens},${s.cost_usd.toFixed(8)},${s.avg_latency_ms}`,
  )
  const csv = [header, ...rows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="edgeroute-stats-${days}d.csv"`,
    },
  })
})

export { exportRoute }

import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { createDb, requestLogs } from '@edgerouteai/db'
import type { AppContext } from '../lib/env.js'

const statsRoute = new Hono<AppContext>()

statsRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const days = Number(c.req.query('days') ?? 7)
  const rows = await db
    .select({
      totalRequests: sql<number>`count(*)`,
      totalInputTokens: sql<number>`coalesce(sum(${requestLogs.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${requestLogs.outputTokens}), 0)`,
      totalCost: sql<number>`coalesce(sum(${requestLogs.costUsd}), 0)`,
      avgLatency: sql<number>`coalesce(avg(${requestLogs.latencyMs}), 0)`,
    })
    .from(requestLogs)
    .where(eq(requestLogs.userId, userId))
  const stats = rows[0] ?? {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    avgLatency: 0,
  }
  return c.json({ stats, period: { days } })
})

export { statsRoute }

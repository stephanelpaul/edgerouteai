import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { createDb, requestLogs } from '@edgerouteai/db'
import type { AppContext } from '../lib/env.js'

const logsRoute = new Hono<AppContext>()

logsRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const offset = Number(c.req.query('offset') ?? 0)
  const provider = c.req.query('provider')
  const model = c.req.query('model')
  const logs = await db
    .select()
    .from(requestLogs)
    .where(eq(requestLogs.userId, userId))
    .orderBy(desc(requestLogs.createdAt))
    .limit(limit)
    .offset(offset)
  const filtered = logs.filter((log) => {
    if (provider && log.provider !== provider) return false
    if (model && log.model !== model) return false
    return true
  })
  return c.json({ logs: filtered })
})

export { logsRoute }

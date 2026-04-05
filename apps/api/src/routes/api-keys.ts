import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { createDb, apiKeys } from '@edgerouteai/db'
import { EdgeRouteError } from '@edgerouteai/shared'
import { hashApiKey } from '../middleware/auth.js'
import type { AppContext } from '../lib/env.js'

const apiKeysRoute = new Hono<AppContext>()

apiKeysRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      rateLimit: apiKeys.rateLimit,
      modelRestrictions: apiKeys.modelRestrictions,
      retryCount: apiKeys.retryCount,
      timeoutMs: apiKeys.timeoutMs,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
  return c.json({ keys })
})

apiKeysRoute.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const body = await c.req.json<{
    name: string
    rateLimit?: number
    modelRestrictions?: string[]
    retryCount?: number
    timeoutMs?: number
  }>()
  const rawKey = `sk-er-${generateRandomString(48)}`
  const keyHash = await hashApiKey(rawKey)
  const keyPrefix = rawKey.substring(0, 12)
  const id = crypto.randomUUID()
  await db.insert(apiKeys).values({
    id,
    userId,
    name: body.name,
    keyHash,
    keyPrefix,
    rateLimit: body.rateLimit ?? null,
    modelRestrictions: body.modelRestrictions ? JSON.stringify(body.modelRestrictions) : null,
    retryCount: body.retryCount ?? 2,
    timeoutMs: body.timeoutMs ?? 30000,
    createdAt: new Date(),
  })
  return c.json({ id, key: rawKey, name: body.name, keyPrefix }, 201)
})

apiKeysRoute.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const keyId = c.req.param('id')
  const db = createDb(c.env.DB)
  const body = await c.req.json<{ retryCount?: number; timeoutMs?: number }>()

  const [key] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1)

  if (!key) {
    throw new EdgeRouteError('API key not found', 'not_found', 404)
  }

  const updates: Partial<typeof apiKeys.$inferInsert> = {}
  if (body.retryCount !== undefined) updates.retryCount = Math.max(0, Math.min(5, body.retryCount))
  if (body.timeoutMs !== undefined) updates.timeoutMs = Math.max(5000, Math.min(60000, body.timeoutMs))

  await db.update(apiKeys).set(updates).where(eq(apiKeys.id, keyId))
  return c.json({ success: true })
})

apiKeysRoute.delete('/:id', async (c) => {
  const keyId = c.req.param('id')
  const db = createDb(c.env.DB)
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId))
  return c.json({ success: true })
})

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(array, (byte) => chars[byte % chars.length]).join('')
}

export { apiKeysRoute }

import { createMiddleware } from 'hono/factory'
import { createDb, apiKeys } from '@edgerouteai/db'
import { eq } from 'drizzle-orm'
import { AuthenticationError } from '@edgerouteai/shared'
import { hashApiKey } from './auth.js'
import type { AppContext } from '../lib/env.js'

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? match[1] : null
}

export const sessionOrKeyAuth = createMiddleware<AppContext>(async (c, next) => {
  // Skip auth for custom auth routes (signup, signin, etc.)
  const path = new URL(c.req.url).pathname
  if (path.startsWith('/api/auth/')) {
    return next()
  }

  const authHeader = c.req.header('Authorization')

  // Try API key auth first
  if (authHeader?.startsWith('Bearer sk-er-')) {
    const apiKey = authHeader.substring(7)
    const keyHash = await hashApiKey(apiKey)
    const db = createDb(c.env.DB)
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1)
    if (keyRecord && !keyRecord.revokedAt) {
      c.set('userId', keyRecord.userId)
      c.set('apiKeyId', keyRecord.id)
      c.set('retryCount', keyRecord.retryCount ?? 2)
      c.set('timeoutMs', keyRecord.timeoutMs ?? 30000)
      // Fetch user role for API key auth
      const userRole = await c.env.DB.prepare('SELECT role FROM "user" WHERE id = ?')
        .bind(keyRecord.userId).first<{ role: string }>()
      c.set('role', userRole?.role ?? 'user')
      c.executionCtx.waitUntil(
        db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id))
      )
      return next()
    }
  }

  // Try session auth via direct D1 query
  const cookieHeader = c.req.header('Cookie')
  const sessionToken = parseCookie(cookieHeader, 'edgeroute_session')

  if (sessionToken) {
    const now = Date.now()
    const result = await c.env.DB.prepare(
      'SELECT s."userId", s."expiresAt", u."role" FROM "session" s JOIN "user" u ON s."userId" = u.id WHERE s."token" = ? AND s."expiresAt" > ?',
    )
      .bind(sessionToken, now)
      .first<{ userId: string; expiresAt: number; role: string }>()

    if (result) {
      c.set('userId', result.userId)
      c.set('apiKeyId', 'session')
      c.set('retryCount', 2)
      c.set('timeoutMs', 30000)
      c.set('role', result.role ?? 'user')
      return next()
    }
  }

  throw new AuthenticationError('Not authenticated. Please sign in or provide an API key.')
})

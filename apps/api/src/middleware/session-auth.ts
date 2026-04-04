import { createMiddleware } from 'hono/factory'
import { createAuth } from '@edgerouteai/auth'
import { createDb, apiKeys } from '@edgerouteai/db'
import { eq } from 'drizzle-orm'
import { AuthenticationError } from '@edgerouteai/shared'
import { hashApiKey } from './auth.js'
import type { AppContext } from '../lib/env.js'

export const sessionOrKeyAuth = createMiddleware<AppContext>(async (c, next) => {
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
      c.executionCtx.waitUntil(
        db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id))
      )
      return next()
    }
  }

  // Try session auth
  const db = createDb(c.env.DB)
  const auth = createAuth(db, {
    baseURL: new URL(c.req.url).origin,
    secret: c.env.ENCRYPTION_KEY,
    trustedOrigins: ['https://edgerouteai-web.pages.dev', 'http://localhost:3000'],
  })

  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (session?.user) {
    c.set('userId', session.user.id)
    c.set('apiKeyId', 'session')
    return next()
  }

  throw new AuthenticationError('Not authenticated. Please sign in or provide an API key.')
})

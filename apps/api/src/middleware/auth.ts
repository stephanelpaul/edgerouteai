import { apiKeys, createDb } from '@edgerouteai/db'
import { AuthenticationError } from '@edgerouteai/shared'
import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import type { AppContext } from '../lib/env.js'

export async function hashApiKey(key: string): Promise<string> {
	const encoded = new TextEncoder().encode(key)
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const authMiddleware = createMiddleware<AppContext>(async (c, next) => {
	const authHeader = c.req.header('Authorization')
	if (!authHeader?.startsWith('Bearer ')) {
		throw new AuthenticationError('Missing or invalid Authorization header')
	}
	const apiKey = authHeader.substring(7)
	if (!apiKey.startsWith('sk-er-')) {
		throw new AuthenticationError('Invalid API key format')
	}
	const keyHash = await hashApiKey(apiKey)
	const db = createDb(c.env.DB)
	const [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1)
	if (!keyRecord || keyRecord.revokedAt) {
		throw new AuthenticationError()
	}
	c.executionCtx.waitUntil(
		db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id)),
	)
	c.set('userId', keyRecord.userId)
	c.set('apiKeyId', keyRecord.id)
	c.set('retryCount', keyRecord.retryCount ?? 2)
	c.set('timeoutMs', keyRecord.timeoutMs ?? 30000)
	await next()
})

import { apiKeys, createDb } from '@edgerouteai/db'
import { AuthenticationError } from '@edgerouteai/shared'
import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import type { McpContext } from './env.js'

async function hashApiKey(apiKey: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey))
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

/**
 * Bearer-token auth using the same `sk-er-...` API keys as the REST gateway.
 * The raw key travels through to downstream gateway calls so the proxy can
 * apply per-key rate limits, retry config, budget, etc.
 */
export const mcpAuth = createMiddleware<McpContext>(async (c, next) => {
	const authHeader = c.req.header('Authorization')
	if (!authHeader?.startsWith('Bearer ')) {
		throw new AuthenticationError('Missing bearer token. Pass your sk-er- API key.')
	}
	const apiKey = authHeader.substring(7).trim()
	if (!apiKey.startsWith('sk-er-')) {
		throw new AuthenticationError('Invalid API key format. Expected sk-er-...')
	}
	const keyHash = await hashApiKey(apiKey)
	const db = createDb(c.env.DB)
	const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1)
	if (!row || row.revokedAt) {
		throw new AuthenticationError('API key not found or revoked.')
	}
	c.set('userId', row.userId)
	c.set('apiKey', apiKey)
	return next()
})

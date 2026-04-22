import { apiKeys, createDb } from '@edgerouteai/db'
import { AuthenticationError } from '@edgerouteai/shared'
import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import type { BillingContext } from './env.js'

// NOTE: duplicated from apps/api/src/middleware/session-auth.ts. Kept as a copy
// rather than a shared package for this phase — the duplication is 40 lines
// and deduping it would require extracting auth into @edgerouteai/auth-worker
// which is out-of-scope for the 14-day window. If/when we touch session logic,
// dedupe at that time.

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
	if (!cookieHeader) return null
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
	return match ? match[1] : null
}

async function hashApiKey(apiKey: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey))
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

export const sessionOrKeyAuth = createMiddleware<BillingContext>(async (c, next) => {
	const authHeader = c.req.header('Authorization')

	if (authHeader?.startsWith('Bearer sk-er-')) {
		const apiKey = authHeader.substring(7)
		const keyHash = await hashApiKey(apiKey)
		const db = createDb(c.env.DB)
		const [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1)
		if (keyRecord && !keyRecord.revokedAt) {
			c.set('userId', keyRecord.userId)
			return next()
		}
	}

	const sessionToken = parseCookie(c.req.header('Cookie'), 'edgeroute_session')
	if (sessionToken) {
		const now = Date.now()
		const result = await c.env.DB.prepare(
			'SELECT "userId" FROM "session" WHERE "token" = ? AND "expiresAt" > ?',
		)
			.bind(sessionToken, now)
			.first<{ userId: string }>()
		if (result) {
			c.set('userId', result.userId)
			return next()
		}
	}

	throw new AuthenticationError('Not authenticated. Please sign in or provide an API key.')
})

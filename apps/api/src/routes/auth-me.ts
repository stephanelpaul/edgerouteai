import { apiKeys, createDb, users } from '@edgerouteai/db'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppContext } from '../lib/env.js'
import { hashApiKey } from '../middleware/auth.js'

const authMeRoute = new Hono<AppContext>()

authMeRoute.get('/me', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)

	// Get user info
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

	// Get their API keys
	const keys = await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			keyPrefix: apiKeys.keyPrefix,
			createdAt: apiKeys.createdAt,
			revokedAt: apiKeys.revokedAt,
		})
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))

	// Get active (non-revoked) keys
	const activeKeys = keys.filter((k) => !k.revokedAt)

	return c.json({
		user: user ? { id: user.id, email: user.email, name: user.name } : null,
		apiKeys: activeKeys,
		hasApiKey: activeKeys.length > 0,
	})
})

// Create first API key for the user (called from dashboard after signup)
authMeRoute.post('/me/create-key', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)

	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	const array = crypto.getRandomValues(new Uint8Array(48))
	const randomStr = Array.from(array, (byte) => chars[byte % chars.length]).join('')
	const rawKey = `sk-er-${randomStr}`
	const keyHash = await hashApiKey(rawKey)
	const keyPrefix = rawKey.substring(0, 12)
	const id = crypto.randomUUID()

	await db.insert(apiKeys).values({
		id,
		userId,
		name: 'Default Key',
		keyHash,
		keyPrefix,
		createdAt: new Date(),
	})

	return c.json({ id, key: rawKey, name: 'Default Key', keyPrefix }, 201)
})

export { authMeRoute }

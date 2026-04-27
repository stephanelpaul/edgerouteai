import { createDb, platformUpstreamKeys } from '@edgerouteai/db'
import { EdgeRouteError } from '@edgerouteai/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { encrypt } from '../lib/crypto.js'
import type { AppContext } from '../lib/env.js'
import { superadminOnly } from '../middleware/admin.js'

// Admin-only routes for managing platform-owned upstream provider keys.
// These are the keys the gateway falls back to when a user has credits but no
// BYOK for a given provider. Only superadmins can add/rotate/revoke them.

const adminPlatformKeysRoute = new Hono<AppContext>()

adminPlatformKeysRoute.use('*', superadminOnly)

// GET /api/admin/platform-keys — list all platform keys (raw keys never
// returned; only metadata).
adminPlatformKeysRoute.get('/', async (c) => {
	const db = createDb(c.env.DB)
	const rows = await db
		.select({
			id: platformUpstreamKeys.id,
			provider: platformUpstreamKeys.provider,
			label: platformUpstreamKeys.label,
			isActive: platformUpstreamKeys.isActive,
			createdAt: platformUpstreamKeys.createdAt,
		})
		.from(platformUpstreamKeys)
	return c.json({ keys: rows })
})

// POST /api/admin/platform-keys — add a new platform key. Body: {provider,
// apiKey, label?}. The raw apiKey is encrypted at-rest with ENCRYPTION_KEY
// and never stored or returned in plaintext.
adminPlatformKeysRoute.post('/', async (c) => {
	const body = await c.req.json<{ provider: string; apiKey: string; label?: string }>()
	if (!body.provider || !body.apiKey) {
		throw new EdgeRouteError('provider and apiKey are required', 'validation_error', 400)
	}
	const allowed = ['openai', 'anthropic', 'google', 'mistral', 'xai']
	if (!allowed.includes(body.provider)) {
		throw new EdgeRouteError(
			`Unknown provider. Allowed: ${allowed.join(', ')}`,
			'validation_error',
			400,
		)
	}
	const db = createDb(c.env.DB)
	const { encrypted, iv } = await encrypt(body.apiKey, c.env.ENCRYPTION_KEY)
	const id = crypto.randomUUID()
	await db.insert(platformUpstreamKeys).values({
		id,
		provider: body.provider,
		label: body.label ?? 'Default',
		encryptedKey: new Uint8Array(encrypted),
		iv: new Uint8Array(iv),
		isActive: true,
		createdAt: new Date(),
	})
	return c.json({
		success: true,
		id,
		provider: body.provider,
		label: body.label ?? 'Default',
	})
})

// PATCH /api/admin/platform-keys/:id — toggle isActive (for temporarily
// disabling a key without deleting the row / losing history).
adminPlatformKeysRoute.patch('/:id', async (c) => {
	const id = c.req.param('id')
	const body = await c.req.json<{ isActive?: boolean }>()
	if (typeof body.isActive !== 'boolean') {
		throw new EdgeRouteError('isActive (boolean) required', 'validation_error', 400)
	}
	const db = createDb(c.env.DB)
	const [existing] = await db
		.select()
		.from(platformUpstreamKeys)
		.where(eq(platformUpstreamKeys.id, id))
		.limit(1)
	if (!existing) {
		throw new EdgeRouteError('Key not found', 'not_found', 404)
	}
	await db
		.update(platformUpstreamKeys)
		.set({ isActive: body.isActive })
		.where(eq(platformUpstreamKeys.id, id))
	return c.json({ success: true, id, isActive: body.isActive })
})

// DELETE /api/admin/platform-keys/:id — permanently delete a platform key.
adminPlatformKeysRoute.delete('/:id', async (c) => {
	const id = c.req.param('id')
	const db = createDb(c.env.DB)
	const [existing] = await db
		.select()
		.from(platformUpstreamKeys)
		.where(eq(platformUpstreamKeys.id, id))
		.limit(1)
	if (!existing) {
		throw new EdgeRouteError('Key not found', 'not_found', 404)
	}
	await db.delete(platformUpstreamKeys).where(eq(platformUpstreamKeys.id, id))
	return c.json({ success: true })
})

export { adminPlatformKeysRoute }

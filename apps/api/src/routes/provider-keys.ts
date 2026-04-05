import { createDb, providerKeys } from '@edgerouteai/db'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { decrypt, encrypt } from '../lib/crypto.js'
import type { AppContext } from '../lib/env.js'

const providerKeysRoute = new Hono<AppContext>()

providerKeysRoute.get('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const keys = await db
		.select({
			id: providerKeys.id,
			provider: providerKeys.provider,
			label: providerKeys.label,
			isValid: providerKeys.isValid,
			lastVerifiedAt: providerKeys.lastVerifiedAt,
			createdAt: providerKeys.createdAt,
		})
		.from(providerKeys)
		.where(eq(providerKeys.userId, userId))
	return c.json({ keys })
})

// Add a new provider key (allows multiple per provider)
providerKeysRoute.post('/', async (c) => {
	const userId = c.get('userId')
	const body = await c.req.json<{ provider: string; apiKey: string; label?: string }>()
	if (!body.provider || !body.apiKey) {
		return c.json(
			{
				error: {
					message: 'provider and apiKey are required',
					code: 'validation_error',
					type: 'edgeroute_error',
				},
			},
			400,
		)
	}
	const db = createDb(c.env.DB)
	const { encrypted, iv } = await encrypt(body.apiKey, c.env.ENCRYPTION_KEY)
	const id = crypto.randomUUID()
	await db.insert(providerKeys).values({
		id,
		userId,
		provider: body.provider,
		label: body.label ?? 'Default',
		encryptedKey: new Uint8Array(encrypted),
		iv: new Uint8Array(iv),
		isValid: true,
		createdAt: new Date(),
	})
	return c.json({ success: true, id, provider: body.provider, label: body.label ?? 'Default' })
})

// Legacy PUT /:provider — kept for backwards compat, replaces all keys for that provider
providerKeysRoute.put('/:provider', async (c) => {
	const userId = c.get('userId')
	const provider = c.req.param('provider')
	const body = await c.req.json<{ apiKey: string; label?: string }>()
	const db = createDb(c.env.DB)
	const { encrypted, iv } = await encrypt(body.apiKey, c.env.ENCRYPTION_KEY)
	await db
		.delete(providerKeys)
		.where(and(eq(providerKeys.userId, userId), eq(providerKeys.provider, provider)))
	const id = crypto.randomUUID()
	await db.insert(providerKeys).values({
		id,
		userId,
		provider,
		label: body.label ?? 'Default',
		encryptedKey: new Uint8Array(encrypted),
		iv: new Uint8Array(iv),
		isValid: true,
		createdAt: new Date(),
	})
	return c.json({ success: true, provider })
})

// Delete a specific key by ID
providerKeysRoute.delete('/:id', async (c) => {
	const userId = c.get('userId')
	const id = c.req.param('id')
	const db = createDb(c.env.DB)
	// Ensure this key belongs to the user
	const [pk] = await db
		.select({ id: providerKeys.id })
		.from(providerKeys)
		.where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
		.limit(1)
	if (!pk)
		return c.json(
			{ error: { message: 'Key not found', code: 'not_found', type: 'edgeroute_error' } },
			404,
		)
	await db.delete(providerKeys).where(eq(providerKeys.id, id))
	return c.json({ success: true })
})

// Verify a specific key by ID
providerKeysRoute.post('/:id/verify', async (c) => {
	const userId = c.get('userId')
	const id = c.req.param('id')
	const db = createDb(c.env.DB)
	const [pk] = await db
		.select()
		.from(providerKeys)
		.where(and(eq(providerKeys.id, id), eq(providerKeys.userId, userId)))
		.limit(1)
	if (!pk) return c.json({ valid: false, error: 'No key found' }, 404)
	const apiKey = await decrypt(
		pk.encryptedKey as unknown as ArrayBuffer,
		pk.iv as unknown as Uint8Array,
		c.env.ENCRYPTION_KEY,
	)
	try {
		const VERIFY_URLS: Record<
			string,
			{ url: string; headers: (k: string) => Record<string, string> }
		> = {
			openai: {
				url: 'https://api.openai.com/v1/models',
				headers: (k) => ({ Authorization: `Bearer ${k}` }),
			},
			anthropic: {
				url: 'https://api.anthropic.com/v1/messages',
				headers: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' }),
			},
			mistral: {
				url: 'https://api.mistral.ai/v1/models',
				headers: (k) => ({ Authorization: `Bearer ${k}` }),
			},
			xai: {
				url: 'https://api.x.ai/v1/models',
				headers: (k) => ({ Authorization: `Bearer ${k}` }),
			},
		}
		const verifier = VERIFY_URLS[pk.provider]
		if (verifier) {
			const res = await fetch(verifier.url, {
				method: 'GET',
				headers: verifier.headers(apiKey),
			})
			const valid = res.ok || res.status === 405
			await db
				.update(providerKeys)
				.set({ isValid: valid, lastVerifiedAt: new Date() })
				.where(eq(providerKeys.id, pk.id))
			return c.json({ valid })
		}
		return c.json({ valid: true, message: 'Verification not available' })
	} catch {
		await db
			.update(providerKeys)
			.set({ isValid: false, lastVerifiedAt: new Date() })
			.where(eq(providerKeys.id, pk.id))
		return c.json({ valid: false, error: 'Verification failed' })
	}
})

export { providerKeysRoute }

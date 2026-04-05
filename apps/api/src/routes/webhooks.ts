import { createDb, webhooks } from '@edgerouteai/db'
import { EdgeRouteError } from '@edgerouteai/shared'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppContext } from '../lib/env.js'

const webhooksRoute = new Hono<AppContext>()

webhooksRoute.get('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const rows = await db.select().from(webhooks).where(eq(webhooks.userId, userId))
	return c.json({ webhooks: rows })
})

webhooksRoute.post('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const body = await c.req.json<{ url: string; events: string[]; secret?: string }>()

	if (!body.url || !body.url.startsWith('http')) {
		throw new EdgeRouteError('url must be a valid HTTP(S) URL', 'validation_error', 400)
	}
	if (!Array.isArray(body.events) || body.events.length === 0) {
		throw new EdgeRouteError('events must be a non-empty array', 'validation_error', 400)
	}

	const validEvents = ['request.completed', 'budget.exceeded']
	for (const evt of body.events) {
		if (!validEvents.includes(evt)) {
			throw new EdgeRouteError(`Unknown event: ${evt}`, 'validation_error', 400)
		}
	}

	const id = crypto.randomUUID()
	await db.insert(webhooks).values({
		id,
		userId,
		url: body.url,
		events: JSON.stringify(body.events),
		secret: body.secret ?? null,
		isActive: true,
		createdAt: new Date(),
	})

	return c.json({ id, url: body.url, events: body.events }, 201)
})

webhooksRoute.put('/:id', async (c) => {
	const userId = c.get('userId')
	const webhookId = c.req.param('id')
	const db = createDb(c.env.DB)
	const body = await c.req.json<{
		url?: string
		events?: string[]
		secret?: string
		isActive?: boolean
	}>()

	const [existing] = await db
		.select()
		.from(webhooks)
		.where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
		.limit(1)

	if (!existing) {
		throw new EdgeRouteError('Webhook not found', 'not_found', 404)
	}

	const updates: Partial<typeof webhooks.$inferInsert> = {}
	if (body.url !== undefined) updates.url = body.url
	if (body.events !== undefined) updates.events = JSON.stringify(body.events)
	if (body.secret !== undefined) updates.secret = body.secret
	if (body.isActive !== undefined) updates.isActive = body.isActive

	await db.update(webhooks).set(updates).where(eq(webhooks.id, webhookId))
	return c.json({ success: true })
})

webhooksRoute.delete('/:id', async (c) => {
	const userId = c.get('userId')
	const webhookId = c.req.param('id')
	const db = createDb(c.env.DB)

	const [existing] = await db
		.select()
		.from(webhooks)
		.where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
		.limit(1)

	if (!existing) {
		throw new EdgeRouteError('Webhook not found', 'not_found', 404)
	}

	await db.delete(webhooks).where(eq(webhooks.id, webhookId))
	return c.json({ success: true })
})

webhooksRoute.post('/:id/test', async (c) => {
	const userId = c.get('userId')
	const webhookId = c.req.param('id')
	const db = createDb(c.env.DB)

	const [wh] = await db
		.select()
		.from(webhooks)
		.where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
		.limit(1)

	if (!wh) {
		throw new EdgeRouteError('Webhook not found', 'not_found', 404)
	}

	const testEvent = {
		event: 'test',
		data: {
			message: 'This is a test event from EdgeRouteAI',
			timestamp: new Date().toISOString(),
		},
	}

	const body = JSON.stringify(testEvent)
	let signature: string | undefined
	if (wh.secret) {
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(wh.secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign'],
		)
		const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
		signature = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')
	}

	try {
		const res = await fetch(wh.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(signature ? { 'X-EdgeRoute-Signature': signature } : {}),
			},
			body,
		})
		return c.json({ success: true, statusCode: res.status })
	} catch (err) {
		const e = err as { message?: string }
		return c.json({ success: false, error: e.message }, 502)
	}
})

export { webhooksRoute }

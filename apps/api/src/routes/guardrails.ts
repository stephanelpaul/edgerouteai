import { apiKeys, createDb, guardrails } from '@edgerouteai/db'
import { EdgeRouteError } from '@edgerouteai/shared'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppContext } from '../lib/env.js'
import { type GuardrailConfig, parseGuardrailConfig } from '../lib/guardrails.js'

const guardrailsRoute = new Hono<AppContext>()

function validateConfig(raw: unknown): GuardrailConfig {
	if (!raw || typeof raw !== 'object') {
		throw new EdgeRouteError('config must be an object', 'validation_error', 400)
	}
	const c = raw as Partial<GuardrailConfig>
	if (c.blockPii?.categories) {
		const allowed = ['email', 'phone', 'ssn', 'creditcard']
		for (const cat of c.blockPii.categories) {
			if (!allowed.includes(cat)) {
				throw new EdgeRouteError(
					`Unknown PII category: ${cat}. Allowed: ${allowed.join(', ')}`,
					'validation_error',
					400,
				)
			}
		}
	}
	if (c.blockedKeywords && !Array.isArray(c.blockedKeywords)) {
		throw new EdgeRouteError('blockedKeywords must be an array', 'validation_error', 400)
	}
	const applyTo = c.applyTo ?? 'input'
	if (!['input', 'output', 'both'].includes(applyTo)) {
		throw new EdgeRouteError('applyTo must be "input" | "output" | "both"', 'validation_error', 400)
	}
	return {
		blockPii: c.blockPii,
		blockedKeywords: c.blockedKeywords,
		applyTo: applyTo as GuardrailConfig['applyTo'],
	}
}

async function ensureKeyOwned(
	c: { env: AppContext['Bindings']; get(k: 'userId'): string },
	apiKeyId: string,
) {
	const db = createDb(c.env.DB)
	const [row] = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.userId, c.get('userId'))))
		.limit(1)
	if (!row) {
		throw new EdgeRouteError('API key not found', 'not_found', 404)
	}
}

// GET /api/guardrails?apiKeyId=...
guardrailsRoute.get('/', async (c) => {
	const apiKeyId = c.req.query('apiKeyId')
	if (!apiKeyId) {
		throw new EdgeRouteError('apiKeyId query parameter required', 'validation_error', 400)
	}
	await ensureKeyOwned(c, apiKeyId)
	const db = createDb(c.env.DB)
	const rows = await db.select().from(guardrails).where(eq(guardrails.apiKeyId, apiKeyId))
	return c.json({
		rails: rows.map((r) => ({
			id: r.id,
			apiKeyId: r.apiKeyId,
			name: r.name,
			config: parseGuardrailConfig(r.config),
			isActive: r.isActive,
			createdAt: r.createdAt,
		})),
	})
})

// POST /api/guardrails  body: { apiKeyId, name, config }
guardrailsRoute.post('/', async (c) => {
	const body = await c.req.json<{
		apiKeyId?: string
		name?: string
		config?: GuardrailConfig
	}>()
	if (!body.apiKeyId) {
		throw new EdgeRouteError('apiKeyId required', 'validation_error', 400)
	}
	if (!body.name?.trim()) {
		throw new EdgeRouteError('name required', 'validation_error', 400)
	}
	const config = validateConfig(body.config)
	await ensureKeyOwned(c, body.apiKeyId)
	const db = createDb(c.env.DB)
	const id = crypto.randomUUID()
	await db.insert(guardrails).values({
		id,
		apiKeyId: body.apiKeyId,
		name: body.name.trim(),
		config: JSON.stringify(config),
		isActive: true,
		createdAt: new Date(),
	})
	return c.json({ success: true, id })
})

// PATCH /api/guardrails/:id  body: { isActive?, config?, name? }
guardrailsRoute.patch('/:id', async (c) => {
	const id = c.req.param('id')
	const body = await c.req.json<{
		isActive?: boolean
		config?: GuardrailConfig
		name?: string
	}>()
	const db = createDb(c.env.DB)
	const [existing] = await db.select().from(guardrails).where(eq(guardrails.id, id)).limit(1)
	if (!existing) throw new EdgeRouteError('Guardrail not found', 'not_found', 404)
	await ensureKeyOwned(c, existing.apiKeyId)

	const update: Partial<{ isActive: boolean; config: string; name: string }> = {}
	if (typeof body.isActive === 'boolean') update.isActive = body.isActive
	if (body.config !== undefined) update.config = JSON.stringify(validateConfig(body.config))
	if (body.name?.trim()) update.name = body.name.trim()
	if (Object.keys(update).length === 0) {
		return c.json({ success: true, noop: true })
	}
	await db.update(guardrails).set(update).where(eq(guardrails.id, id))
	return c.json({ success: true })
})

// DELETE /api/guardrails/:id
guardrailsRoute.delete('/:id', async (c) => {
	const id = c.req.param('id')
	const db = createDb(c.env.DB)
	const [existing] = await db.select().from(guardrails).where(eq(guardrails.id, id)).limit(1)
	if (!existing) throw new EdgeRouteError('Guardrail not found', 'not_found', 404)
	await ensureKeyOwned(c, existing.apiKeyId)
	await db.delete(guardrails).where(eq(guardrails.id, id))
	return c.json({ success: true })
})

export { guardrailsRoute }

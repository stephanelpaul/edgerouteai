import { apiKeys, createDb, requestTransforms } from '@edgerouteai/db'
import { EdgeRouteError } from '@edgerouteai/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppContext } from '../lib/env.js'

const requestTransformsRoute = new Hono<AppContext>()

const VALID_TYPES = ['prepend_system', 'append_system', 'set_parameter'] as const

requestTransformsRoute.get('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)

	// Get user's API keys
	const userKeys = await db
		.select({ id: apiKeys.id, name: apiKeys.name })
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))

	if (userKeys.length === 0) {
		return c.json({ transforms: [] })
	}

	const keyIds = userKeys.map((k) => k.id)
	const transforms = await db
		.select()
		.from(requestTransforms)
		.where(inArray(requestTransforms.apiKeyId, keyIds))

	const keyMap = Object.fromEntries(userKeys.map((k) => [k.id, k.name]))
	const enriched = transforms.map((t) => ({
		...t,
		apiKeyName: keyMap[t.apiKeyId] ?? 'Unknown',
	}))

	return c.json({ transforms: enriched })
})

requestTransformsRoute.post('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const body = await c.req.json<{ apiKeyId: string; type: string; value: string }>()

	if (!body.apiKeyId || !body.type || !body.value) {
		throw new EdgeRouteError('apiKeyId, type, and value are required', 'validation_error', 400)
	}

	if (!VALID_TYPES.includes(body.type as (typeof VALID_TYPES)[number])) {
		throw new EdgeRouteError(
			`type must be one of: ${VALID_TYPES.join(', ')}`,
			'validation_error',
			400,
		)
	}

	// Verify API key belongs to user
	const [key] = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(and(eq(apiKeys.id, body.apiKeyId), eq(apiKeys.userId, userId)))
		.limit(1)

	if (!key) {
		throw new EdgeRouteError('API key not found', 'not_found', 404)
	}

	// Validate value for set_parameter type
	if (body.type === 'set_parameter') {
		try {
			JSON.parse(body.value)
		} catch {
			throw new EdgeRouteError(
				'value must be valid JSON for set_parameter type',
				'validation_error',
				400,
			)
		}
	}

	const id = crypto.randomUUID()
	await db.insert(requestTransforms).values({
		id,
		apiKeyId: body.apiKeyId,
		type: body.type,
		value: body.value,
		isActive: true,
		createdAt: new Date(),
	})

	return c.json({ id, apiKeyId: body.apiKeyId, type: body.type, value: body.value }, 201)
})

requestTransformsRoute.delete('/:id', async (c) => {
	const userId = c.get('userId')
	const transformId = c.req.param('id')
	const db = createDb(c.env.DB)

	// Get the transform and verify it belongs to a key owned by this user
	const [transform] = await db
		.select()
		.from(requestTransforms)
		.where(eq(requestTransforms.id, transformId))
		.limit(1)

	if (!transform) {
		throw new EdgeRouteError('Transform not found', 'not_found', 404)
	}

	// Verify the API key belongs to this user
	const [key] = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(and(eq(apiKeys.id, transform.apiKeyId), eq(apiKeys.userId, userId)))
		.limit(1)

	if (!key) {
		throw new EdgeRouteError('Transform not found', 'not_found', 404)
	}

	await db.delete(requestTransforms).where(eq(requestTransforms.id, transformId))
	return c.json({ success: true })
})

export { requestTransformsRoute }

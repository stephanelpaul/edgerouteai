import { apiKeys, budgets, createDb } from '@edgerouteai/db'
import { EdgeRouteError } from '@edgerouteai/shared'
import { eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppContext } from '../lib/env.js'

const budgetsRoute = new Hono<AppContext>()

budgetsRoute.get('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)

	// Get user's API keys
	const userKeys = await db
		.select({ id: apiKeys.id, name: apiKeys.name })
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))

	if (userKeys.length === 0) {
		return c.json({ budgets: [] })
	}

	const keyIds = userKeys.map((k) => k.id)
	const budgetRows = await db.select().from(budgets).where(inArray(budgets.apiKeyId, keyIds))

	// Enrich with key names
	const keyMap = Object.fromEntries(userKeys.map((k) => [k.id, k.name]))
	const enriched = budgetRows.map((b) => ({
		...b,
		apiKeyName: keyMap[b.apiKeyId] ?? 'Unknown',
	}))

	return c.json({ budgets: enriched })
})

budgetsRoute.put('/:apiKeyId', async (c) => {
	const userId = c.get('userId')
	const apiKeyId = c.req.param('apiKeyId')
	const db = createDb(c.env.DB)
	const body = await c.req.json<{ monthlyLimitUsd: number }>()

	if (typeof body.monthlyLimitUsd !== 'number' || body.monthlyLimitUsd <= 0) {
		throw new EdgeRouteError('monthlyLimitUsd must be a positive number', 'validation_error', 400)
	}

	// Verify API key belongs to user
	const [key] = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(eq(apiKeys.id, apiKeyId))
		.limit(1)

	if (!key) {
		throw new EdgeRouteError('API key not found', 'not_found', 404)
	}

	// Check if budget exists
	const [existing] = await db.select().from(budgets).where(eq(budgets.apiKeyId, apiKeyId)).limit(1)

	if (existing) {
		await db
			.update(budgets)
			.set({ monthlyLimitUsd: body.monthlyLimitUsd })
			.where(eq(budgets.apiKeyId, apiKeyId))
		return c.json({ success: true, updated: true })
	}

	// Create new budget
	const id = crypto.randomUUID()
	await db.insert(budgets).values({
		id,
		apiKeyId,
		monthlyLimitUsd: body.monthlyLimitUsd,
		currentSpendUsd: 0,
		periodStart: new Date(),
		isDisabled: false,
		createdAt: new Date(),
	})

	return c.json({ success: true, created: true }, 201)
})

budgetsRoute.delete('/:apiKeyId', async (c) => {
	const apiKeyId = c.req.param('apiKeyId')
	const db = createDb(c.env.DB)

	await db.delete(budgets).where(eq(budgets.apiKeyId, apiKeyId))

	return c.json({ success: true })
})

export { budgetsRoute }

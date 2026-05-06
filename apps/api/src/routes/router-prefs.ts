// Smart-router v4: read/write user preference overrides for the auto-router.
//
// One row per (userId, apiKeyId), where apiKeyId NULL = the user-wide default.
// PUT acts as upsert keyed on (userId, apiKeyId | null) so callers don't need
// to know whether a row already exists. JSON columns hold provider-id arrays.
import { type Database, createDb, userRouterPreferences } from '@edgerouteai/db'
import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppContext } from '../lib/env.js'

const routerPrefsRoute = new Hono<AppContext>()

interface PrefsBody {
	apiKeyId?: string | null
	pinnedProviders?: string[]
	excludedProviders?: string[]
	maxCostPerRequestCents?: number | null
}

function serializePref(row: typeof userRouterPreferences.$inferSelect) {
	return {
		id: row.id,
		apiKeyId: row.apiKeyId,
		pinnedProviders: safeParseStringArray(row.pinnedProviders),
		excludedProviders: safeParseStringArray(row.excludedProviders),
		maxCostPerRequestCents: row.maxCostPerRequestCents,
		updatedAt: row.updatedAt,
	}
}

function safeParseStringArray(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
	} catch {
		return []
	}
}

routerPrefsRoute.get('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const rows = await db
		.select()
		.from(userRouterPreferences)
		.where(eq(userRouterPreferences.userId, userId))
	return c.json({ preferences: rows.map(serializePref) })
})

routerPrefsRoute.put('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const body = await c.req.json<PrefsBody>()

	const apiKeyId = body.apiKeyId ?? null
	const pinned = JSON.stringify(body.pinnedProviders ?? [])
	const excluded = JSON.stringify(body.excludedProviders ?? [])
	const maxCost = body.maxCostPerRequestCents === undefined ? null : body.maxCostPerRequestCents
	const now = new Date()

	const existing = await findExisting(db, userId, apiKeyId)

	if (existing) {
		await db
			.update(userRouterPreferences)
			.set({
				pinnedProviders: pinned,
				excludedProviders: excluded,
				maxCostPerRequestCents: maxCost,
				updatedAt: now,
			})
			.where(eq(userRouterPreferences.id, existing.id))
		return c.json({ id: existing.id, updated: true })
	}

	const id = crypto.randomUUID()
	await db.insert(userRouterPreferences).values({
		id,
		userId,
		apiKeyId,
		pinnedProviders: pinned,
		excludedProviders: excluded,
		maxCostPerRequestCents: maxCost,
		createdAt: now,
		updatedAt: now,
	})
	return c.json({ id, created: true }, 201)
})

routerPrefsRoute.delete('/:id', async (c) => {
	const userId = c.get('userId')
	const id = c.req.param('id')
	const db = createDb(c.env.DB)
	await db
		.delete(userRouterPreferences)
		.where(and(eq(userRouterPreferences.id, id), eq(userRouterPreferences.userId, userId)))
	return c.json({ success: true })
})

async function findExisting(db: Database, userId: string, apiKeyId: string | null) {
	const condition =
		apiKeyId === null
			? and(eq(userRouterPreferences.userId, userId), isNull(userRouterPreferences.apiKeyId))
			: and(eq(userRouterPreferences.userId, userId), eq(userRouterPreferences.apiKeyId, apiKeyId))
	const [row] = await db.select().from(userRouterPreferences).where(condition).limit(1)
	return row
}

export { routerPrefsRoute }

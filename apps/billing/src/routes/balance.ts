import { createDb, usageLedger, userCredits } from '@edgerouteai/db'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { BillingContext } from '../lib/env.js'

export const balanceRoute = new Hono<BillingContext>()

balanceRoute.get('/', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const [row] = await db.select().from(userCredits).where(eq(userCredits.userId, userId)).limit(1)
	return c.json({
		balanceCents: row?.balanceCents ?? 0,
		lifetimeToppedUpCents: row?.lifetimeToppedUpCents ?? 0,
		lifetimeSpentCents: row?.lifetimeSpentCents ?? 0,
	})
})

balanceRoute.get('/history', async (c) => {
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const rows = await db
		.select()
		.from(usageLedger)
		.where(eq(usageLedger.userId, userId))
		.orderBy(desc(usageLedger.createdAt))
		.limit(50)
	return c.json({
		entries: rows.map((r) => ({
			id: r.id,
			requestLogId: r.requestLogId,
			costCents: r.costCents,
			markupCents: r.markupCents,
			totalDebitedCents: r.totalDebitedCents,
			createdAt: r.createdAt,
		})),
	})
})

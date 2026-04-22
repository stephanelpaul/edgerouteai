import { createDb, users } from '@edgerouteai/db'
import { EdgeRouteError } from '@edgerouteai/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { BillingContext } from '../lib/env.js'
import { createCheckout, isValidPackSize } from '../lib/polar.js'

export const checkoutRoute = new Hono<BillingContext>()

checkoutRoute.post('/', async (c) => {
	const body = (await c.req.json().catch(() => ({}))) as { packUsd?: number | string }
	const packUsd = Number(body.packUsd)
	if (!isValidPackSize(packUsd)) {
		throw new EdgeRouteError('Invalid pack. Allowed: 5, 20, 50, 100.', 'invalid_pack', 400)
	}
	const userId = c.get('userId')
	const db = createDb(c.env.DB)
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
	if (!user) throw new EdgeRouteError('User not found.', 'user_not_found', 404)

	const checkout = await createCheckout(c.env, {
		userId,
		userEmail: user.email,
		packUsd,
		successUrl: `${c.env.DASHBOARD_URL}/dashboard/billing?topup=success`,
		cancelUrl: `${c.env.DASHBOARD_URL}/dashboard/billing?topup=cancelled`,
	})
	return c.json({ url: checkout.url, sessionId: checkout.id })
})

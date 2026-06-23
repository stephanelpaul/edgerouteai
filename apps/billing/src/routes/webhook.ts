import { createDb, paymentEvents, userCredits } from '@edgerouteai/db'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { BillingContext } from '../lib/env.js'
import { verifyWebhookSignature } from '../lib/polar.js'

export const webhookRoute = new Hono<BillingContext>()

// No auth middleware on this route; the signature IS the auth.
webhookRoute.post('/', async (c) => {
	const id = c.req.header('webhook-id')
	const timestamp = c.req.header('webhook-timestamp')
	const signature = c.req.header('webhook-signature')
	if (!id || !timestamp || !signature) {
		return c.text('missing webhook headers', 400)
	}
	const rawBody = await c.req.text()
	const ok = await verifyWebhookSignature({
		id,
		timestamp,
		body: rawBody,
		signatureHeader: signature,
		secret: c.env.POLAR_WEBHOOK_SECRET,
	})
	if (!ok) return c.text('invalid signature', 401)

	// Reject events older than 5 minutes to limit replay window.
	const tsMs = Number(timestamp) * 1000
	if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
		return c.text('stale timestamp', 400)
	}

	let event: {
		type: string
		data: {
			id?: string
			metadata?: { userId?: string; amountCents?: string; packUsd?: string }
			status?: string
			amount?: number
			customer_email?: string
		}
	}
	try {
		event = JSON.parse(rawBody)
	} catch {
		return c.text('invalid json', 400)
	}

	const db = createDb(c.env.DB)

	// Idempotency: INSERT ... ON CONFLICT DO NOTHING gives us at-most-once
	// semantics keyed on Polar's webhook-id header. If the row already exists
	// we short-circuit and return 200 so Polar doesn't retry.
	const insertResult = await db.run(
		sql`INSERT INTO payment_events (event_id, provider, type, user_id, amount_cents, processed_at)
		    VALUES (${id}, 'polar', ${event.type}, ${event.data.metadata?.userId ?? null},
		            ${event.data.metadata?.amountCents ? Number(event.data.metadata.amountCents) : null},
		            ${Date.now()})
		    ON CONFLICT(event_id) DO NOTHING`,
	)
	const meta = insertResult.meta as { rows_written?: number; changes?: number } | undefined
	const alreadyProcessed = (meta?.rows_written ?? meta?.changes ?? 0) === 0
	if (alreadyProcessed) {
		return c.json({ ok: true, replay: true })
	}

	// We only credit on "order.paid" (or equivalent success event). Polar's
	// event names may evolve; accept both "order.paid" and "checkout.completed"
	// defensively, but require metadata.userId + amountCents in either case.
	const isPaidEvent = event.type === 'order.paid' || event.type === 'checkout.completed'
	const userId = event.data.metadata?.userId
	const amountCents = event.data.metadata?.amountCents
		? Number(event.data.metadata.amountCents)
		: null

	if (isPaidEvent && userId && amountCents && amountCents > 0) {
		await db.run(
			sql`INSERT INTO user_credits (user_id, balance_cents, lifetime_topped_up_cents, lifetime_spent_cents, updated_at)
			    VALUES (${userId}, ${amountCents}, ${amountCents}, 0, ${Date.now()})
			    ON CONFLICT(user_id) DO UPDATE SET
			      balance_cents = balance_cents + ${amountCents},
			      lifetime_topped_up_cents = lifetime_topped_up_cents + ${amountCents},
			      updated_at = ${Date.now()}`,
		)
	}

	return c.json({ ok: true })
})

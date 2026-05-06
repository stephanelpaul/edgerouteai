import { EdgeRouteError } from '@edgerouteai/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sessionOrKeyAuth } from './lib/auth.js'
import type { BillingContext } from './lib/env.js'
import { balanceRoute } from './routes/balance.js'
import { checkoutRoute } from './routes/checkout.js'
import { webhookRoute } from './routes/webhook.js'

const app = new Hono<BillingContext>()

app.use(
	'*',
	cors({
		origin: ['https://edgerouteai-web.pages.dev', 'http://localhost:3000'],
		credentials: true,
	}),
)
app.use('*', logger())

app.get('/health', (c) => c.json({ status: 'ok', service: 'edgerouteai-billing' }))

// Webhook has no auth (signature IS auth). Mount before the auth middleware.
app.route('/webhook', webhookRoute)

// Everything else requires session or API-key auth.
app.use('/*', sessionOrKeyAuth)
app.route('/checkout', checkoutRoute)
app.route('/balance', balanceRoute)

app.onError((err, c) => {
	if (err instanceof EdgeRouteError) {
		return c.json(err.toJSON(), err.status as Parameters<typeof c.json>[1])
	}
	console.error('billing unhandled error:', err)
	return c.json(
		{
			error: { message: 'Internal server error', code: 'internal_error', type: 'edgeroute_error' },
		},
		500,
	)
})

app.notFound((c) =>
	c.json({ error: { message: 'Not found', code: 'not_found', type: 'edgeroute_error' } }, 404),
)

export default app

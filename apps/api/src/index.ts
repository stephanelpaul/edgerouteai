import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { EdgeRouteError } from '@edgerouteai/shared'
import { authMiddleware } from './middleware/auth.js'
import { rateLimitMiddleware } from './middleware/rate-limit.js'
import { proxy } from './routes/proxy.js'
import { apiKeysRoute } from './routes/api-keys.js'
import { providerKeysRoute } from './routes/provider-keys.js'
import { logsRoute } from './routes/logs.js'
import { statsRoute } from './routes/stats.js'
import { routingConfigsRoute } from './routes/routing-configs.js'
import type { AppContext } from './lib/env.js'

const app = new Hono<AppContext>()

app.use('*', cors())
app.use('*', logger())

app.get('/health', (c) => c.json({ status: 'ok', service: 'edgerouteai' }))

app.use('/v1/*', authMiddleware)
app.use('/v1/chat/*', rateLimitMiddleware)
app.route('/', proxy)

app.use('/api/*', authMiddleware)
app.route('/api/keys', apiKeysRoute)
app.route('/api/providers', providerKeysRoute)
app.route('/api/logs', logsRoute)
app.route('/api/stats', statsRoute)
app.route('/api/routing', routingConfigsRoute)

app.onError((err, c) => {
  if (err instanceof EdgeRouteError) return c.json(err.toJSON(), err.status as Parameters<typeof c.json>[1])
  console.error('Unhandled error:', err)
  return c.json(
    { error: { message: 'Internal server error', code: 'internal_error', type: 'edgeroute_error' } },
    500,
  )
})

app.notFound((c) =>
  c.json(
    { error: { message: 'Not found', code: 'not_found', type: 'edgeroute_error' } },
    404,
  ),
)

export default app

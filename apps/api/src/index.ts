import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { EdgeRouteError } from '@edgerouteai/shared'
import { createAuth } from '@edgerouteai/auth'
import { createDb } from '@edgerouteai/db'
import { authMiddleware } from './middleware/auth.js'
import { sessionOrKeyAuth } from './middleware/session-auth.js'
import { rateLimitMiddleware } from './middleware/rate-limit.js'
import { proxy } from './routes/proxy.js'
import { apiKeysRoute } from './routes/api-keys.js'
import { providerKeysRoute } from './routes/provider-keys.js'
import { logsRoute } from './routes/logs.js'
import { statsRoute } from './routes/stats.js'
import { routingConfigsRoute } from './routes/routing-configs.js'
import { authMeRoute } from './routes/auth-me.js'
import { modelAliasesRoute } from './routes/model-aliases.js'
import { budgetsRoute } from './routes/budgets.js'
import type { AppContext } from './lib/env.js'

const app = new Hono<AppContext>()

app.use('*', cors({
  origin: ['https://edgerouteai-web.pages.dev', 'http://localhost:3000'],
  credentials: true,
}))
app.use('*', logger())

app.get('/health', (c) => c.json({ status: 'ok', service: 'edgerouteai' }))

// Better Auth handler — must be BEFORE the sessionOrKeyAuth middleware
app.on(['GET', 'POST'], '/api/auth/**', async (c) => {
  const db = createDb(c.env.DB)
  const auth = createAuth(db, {
    baseURL: new URL(c.req.url).origin,
    secret: c.env.ENCRYPTION_KEY,
    trustedOrigins: ['https://edgerouteai-web.pages.dev', 'http://localhost:3000'],
  })
  return auth.handler(c.req.raw)
})

// Proxy routes — API key only
app.use('/v1/*', authMiddleware)
app.use('/v1/chat/*', rateLimitMiddleware)
app.route('/', proxy)

// Dashboard management routes — session OR API key
app.use('/api/*', sessionOrKeyAuth)
app.route('/api/keys', apiKeysRoute)
app.route('/api/providers', providerKeysRoute)
app.route('/api/logs', logsRoute)
app.route('/api/stats', statsRoute)
app.route('/api/routing', routingConfigsRoute)
app.route('/api/account', authMeRoute)
app.route('/api/aliases', modelAliasesRoute)
app.route('/api/budgets', budgetsRoute)

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

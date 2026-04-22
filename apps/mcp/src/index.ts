import { EdgeRouteError } from '@edgerouteai/shared'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { mcpAuth } from './auth.js'
import type { McpContext } from './env.js'
import { handleRpc } from './rpc.js'

const app = new Hono<McpContext>()

app.use('*', cors({ origin: '*', credentials: false }))

app.get('/health', (c) => c.json({ status: 'ok', service: 'edgerouteai-mcp' }))

// MCP's Streamable HTTP transport lives at a single POST endpoint. The SDK
// convention is /mcp — accept both /mcp and / for compatibility with clients
// that default to either.
app.use('/mcp', mcpAuth)
app.use('/', mcpAuth)

async function handleMcpRequest(c: Context<McpContext>) {
	const body = await c.req.json().catch(() => null)
	if (!body) {
		return c.json(
			{ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
			400,
		)
	}
	const userId = c.get('userId')
	const apiKey = c.get('apiKey')

	if (Array.isArray(body)) {
		const responses = await Promise.all(
			body.map((r) => handleRpc({ req: r, env: c.env, userId, apiKey })),
		)
		const nonNotifications = responses.filter((r) => r.id !== null && r.id !== undefined)
		return c.json(nonNotifications)
	}
	const response = await handleRpc({ req: body, env: c.env, userId, apiKey })
	return c.json(response)
}

app.post('/mcp', handleMcpRequest)
app.post('/', handleMcpRequest)

app.onError((err, c) => {
	if (err instanceof EdgeRouteError) {
		return c.json(err.toJSON(), err.status as Parameters<typeof c.json>[1])
	}
	console.error('mcp unhandled error:', err)
	return c.json(
		{ error: { message: 'Internal server error', code: 'internal_error', type: 'edgeroute_error' } },
		500,
	)
})

app.notFound((c) => c.json({ error: { message: 'Not found', code: 'not_found' } }, 404))

export default app

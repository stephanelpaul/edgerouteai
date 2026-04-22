import { EdgeRouteError } from '@edgerouteai/shared'
import type { McpEnv } from './env.js'
import { TOOLS, callAutoSelectModel, callChat, callGetUsage, callListModels } from './tools.js'

// JSON-RPC 2.0 types — minimal subset we actually use.
interface JsonRpcRequest {
	jsonrpc: '2.0'
	id?: string | number | null
	method: string
	params?: Record<string, unknown>
}

interface JsonRpcSuccess {
	jsonrpc: '2.0'
	id: string | number | null
	result: unknown
}

interface JsonRpcError {
	jsonrpc: '2.0'
	id: string | number | null
	error: { code: number; message: string; data?: unknown }
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError

const MCP_ERROR = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
} as const

const PROTOCOL_VERSION = '2025-03-26'
const SERVER_INFO = { name: 'edgerouteai-mcp', version: '0.0.1' }

function success(id: string | number | null, result: unknown): JsonRpcSuccess {
	return { jsonrpc: '2.0', id, result }
}

function failure(
	id: string | number | null,
	code: number,
	message: string,
	data?: unknown,
): JsonRpcError {
	return { jsonrpc: '2.0', id, error: { code, message, data } }
}

export async function handleRpc(opts: {
	req: JsonRpcRequest
	env: McpEnv
	userId: string
	apiKey: string
}): Promise<JsonRpcResponse> {
	const { req, env, userId, apiKey } = opts
	const id = req.id ?? null

	if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
		return failure(id, MCP_ERROR.INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request')
	}

	try {
		switch (req.method) {
			case 'initialize':
				return success(id, {
					protocolVersion: PROTOCOL_VERSION,
					serverInfo: SERVER_INFO,
					capabilities: { tools: {} },
				})

			case 'notifications/initialized':
			case 'notifications/cancelled':
				// JSON-RPC notifications have no id and no response. We still accept
				// them with an id for compatibility with loose clients.
				return success(id, {})

			case 'tools/list':
				return success(id, { tools: TOOLS })

			case 'tools/call': {
				const params = req.params as
					| { name?: string; arguments?: Record<string, unknown> }
					| undefined
				const name = params?.name
				const args = params?.arguments ?? {}
				if (!name) {
					return failure(id, MCP_ERROR.INVALID_PARAMS, 'Missing tool name')
				}
				const result = await dispatchTool({ name, args, env, userId, apiKey })
				return success(id, result)
			}

			case 'ping':
				return success(id, {})

			default:
				return failure(id, MCP_ERROR.METHOD_NOT_FOUND, `Method not found: ${req.method}`)
		}
	} catch (err) {
		if (err instanceof EdgeRouteError) {
			return failure(id, MCP_ERROR.INTERNAL_ERROR, err.message, { code: err.code })
		}
		const msg = err instanceof Error ? err.message : 'Internal error'
		return failure(id, MCP_ERROR.INTERNAL_ERROR, msg)
	}
}

async function dispatchTool(opts: {
	name: string
	args: Record<string, unknown>
	env: McpEnv
	userId: string
	apiKey: string
}): Promise<unknown> {
	const { name, args, env, userId, apiKey } = opts
	switch (name) {
		case 'chat': {
			const body = args as {
				model?: string
				messages?: Array<{ role: string; content: string }>
				temperature?: number
				max_tokens?: number
			}
			if (!body.model || !Array.isArray(body.messages)) {
				throw new Error('chat requires { model, messages }')
			}
			return callChat({
				env,
				apiKey,
				body: {
					model: body.model,
					messages: body.messages as Array<{
						role: 'system' | 'user' | 'assistant'
						content: string
					}>,
					temperature: body.temperature,
					max_tokens: body.max_tokens,
				},
			})
		}
		case 'list_models':
			return callListModels({ env, userId })
		case 'get_usage':
			return callGetUsage({ env, userId })
		case 'auto_select_model': {
			const task = args.task
			if (typeof task !== 'string' || task.length === 0) {
				throw new Error('auto_select_model requires { task: string }')
			}
			return callAutoSelectModel({ env, userId, task })
		}
		default:
			throw new Error(`Unknown tool: ${name}`)
	}
}

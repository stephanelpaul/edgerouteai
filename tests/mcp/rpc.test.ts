import { describe, expect, it } from 'vitest'
import { handleRpc } from '../../apps/mcp/src/rpc'
import { TOOLS } from '../../apps/mcp/src/tools'
import type { McpEnv } from '../../apps/mcp/src/env'

function mockEnv(): McpEnv {
	// Most tests don't touch env; when they do we give an empty-ish fake.
	return {
		DB: {} as unknown as D1Database,
		ENVIRONMENT: 'test',
		API_BASE_URL: 'http://localhost:8787',
	}
}

describe('mcp.rpc.initialize', () => {
	it('returns the protocol version and server info', async () => {
		const res = await handleRpc({
			req: { jsonrpc: '2.0', id: 1, method: 'initialize' },
			env: mockEnv(),
			userId: 'u1',
			apiKey: 'sk-er-test',
		})
		expect('result' in res).toBe(true)
		if ('result' in res) {
			const r = res.result as {
				protocolVersion: string
				serverInfo: { name: string }
				capabilities: { tools: object }
			}
			expect(r.protocolVersion).toBe('2025-03-26')
			expect(r.serverInfo.name).toBe('edgerouteai-mcp')
			expect(r.capabilities.tools).toEqual({})
		}
	})
})

describe('mcp.rpc.tools/list', () => {
	it('returns all 4 tools with schemas', async () => {
		const res = await handleRpc({
			req: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
			env: mockEnv(),
			userId: 'u1',
			apiKey: 'sk-er-test',
		})
		expect('result' in res).toBe(true)
		if ('result' in res) {
			const r = res.result as { tools: Array<{ name: string }> }
			expect(r.tools).toHaveLength(4)
			const names = r.tools.map((t) => t.name).sort()
			expect(names).toEqual(['auto_select_model', 'chat', 'get_usage', 'list_models'])
		}
	})
})

describe('mcp.rpc.validation', () => {
	it('rejects non-2.0 jsonrpc version', async () => {
		const res = await handleRpc({
			req: { jsonrpc: '1.0' as unknown as '2.0', id: 1, method: 'ping' },
			env: mockEnv(),
			userId: 'u1',
			apiKey: 'sk-er-test',
		})
		expect('error' in res).toBe(true)
		if ('error' in res) expect(res.error.code).toBe(-32600)
	})

	it('returns method_not_found for unknown method', async () => {
		const res = await handleRpc({
			req: { jsonrpc: '2.0', id: 1, method: 'bogus/method' },
			env: mockEnv(),
			userId: 'u1',
			apiKey: 'sk-er-test',
		})
		expect('error' in res).toBe(true)
		if ('error' in res) {
			expect(res.error.code).toBe(-32601)
			expect(res.error.message).toContain('bogus/method')
		}
	})

	it('returns invalid_params for tools/call without name', async () => {
		const res = await handleRpc({
			req: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} },
			env: mockEnv(),
			userId: 'u1',
			apiKey: 'sk-er-test',
		})
		expect('error' in res).toBe(true)
		if ('error' in res) expect(res.error.code).toBe(-32602)
	})

	it('returns internal_error for unknown tool name', async () => {
		const res = await handleRpc({
			req: {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: { name: 'bogus', arguments: {} },
			},
			env: mockEnv(),
			userId: 'u1',
			apiKey: 'sk-er-test',
		})
		expect('error' in res).toBe(true)
		if ('error' in res) {
			expect(res.error.code).toBe(-32603)
			expect(res.error.message).toContain('Unknown tool')
		}
	})
})

describe('mcp.rpc.notifications', () => {
	it('accepts notifications/initialized without error', async () => {
		const res = await handleRpc({
			req: { jsonrpc: '2.0', id: null, method: 'notifications/initialized' },
			env: mockEnv(),
			userId: 'u1',
			apiKey: 'sk-er-test',
		})
		expect('result' in res).toBe(true)
	})
})

describe('mcp.tools schemas', () => {
	it.each(TOOLS)('tool "$name" has required schema fields', (tool) => {
		expect(tool.name).toBeTruthy()
		expect(tool.description.length).toBeGreaterThan(20)
		expect(tool.inputSchema).toBeDefined()
		expect(tool.inputSchema.type).toBe('object')
	})

	it('chat tool requires model and messages', () => {
		const chat = TOOLS.find((t) => t.name === 'chat')
		expect(chat).toBeDefined()
		if (chat && 'required' in chat.inputSchema) {
			expect(chat.inputSchema.required).toContain('model')
			expect(chat.inputSchema.required).toContain('messages')
		}
	})
})

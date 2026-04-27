import { describe, expect, it, vi } from 'vitest'
import { forward } from '../../packages/mcp-stdio/src/lib'

describe('mcp-stdio.forward', () => {
	const endpoint = 'https://mcp.edgerouteai.com/mcp'
	const apiKey = 'sk-er-test'

	function makeFakeFetch(response: {
		status: number
		body: string
	}): typeof fetch {
		return vi.fn().mockResolvedValue(
			new Response(response.body, {
				status: response.status,
				headers: { 'Content-Type': 'application/json' },
			}),
		) as unknown as typeof fetch
	}

	it('sends POST with Bearer auth and request body as-is', async () => {
		const fetchImpl = makeFakeFetch({ status: 200, body: '{"jsonrpc":"2.0","id":1,"result":{}}' })
		const out: string[] = []
		await forward({
			message: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
			endpoint,
			apiKey,
			fetchImpl,
			writeOut: (s) => out.push(s),
			writeErr: () => undefined,
		})
		const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>
		const [url, init] = mock.mock.calls[0]
		expect(url).toBe(endpoint)
		expect((init as RequestInit).method).toBe('POST')
		const headers = (init as RequestInit).headers as Record<string, string>
		expect(headers.Authorization).toBe(`Bearer ${apiKey}`)
		expect(headers['Content-Type']).toBe('application/json')
		expect((init as RequestInit).body).toBe('{"jsonrpc":"2.0","id":1,"method":"ping"}')
	})

	it('writes response to stdout with trailing newline', async () => {
		const fetchImpl = makeFakeFetch({ status: 200, body: '{"jsonrpc":"2.0","id":1,"result":{}}' })
		const out: string[] = []
		await forward({
			message: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
			endpoint,
			apiKey,
			fetchImpl,
			writeOut: (s) => out.push(s),
			writeErr: () => undefined,
		})
		expect(out.join('')).toBe('{"jsonrpc":"2.0","id":1,"result":{}}\n')
	})

	it('does not double-newline when response already ends with newline', async () => {
		const fetchImpl = makeFakeFetch({ status: 200, body: '{"jsonrpc":"2.0","id":1,"result":{}}\n' })
		const out: string[] = []
		await forward({
			message: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
			endpoint,
			apiKey,
			fetchImpl,
			writeOut: (s) => out.push(s),
			writeErr: () => undefined,
		})
		expect(out.join('').endsWith('\n\n')).toBe(false)
	})

	it('logs to stderr on non-2xx responses but still writes the body', async () => {
		const fetchImpl = makeFakeFetch({ status: 401, body: '{"error":"Unauthorized"}' })
		const out: string[] = []
		const err: string[] = []
		await forward({
			message: '{"jsonrpc":"2.0","id":1}',
			endpoint,
			apiKey,
			fetchImpl,
			writeOut: (s) => out.push(s),
			writeErr: (s) => err.push(s),
		})
		expect(out.join('')).toContain('Unauthorized')
		expect(err.join('')).toContain('HTTP 401')
	})

	it('emits a synthetic JSON-RPC error on network failure, preserving request id', async () => {
		const fetchImpl = vi
			.fn()
			.mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch
		const out: string[] = []
		const err: string[] = []
		await forward({
			message: '{"jsonrpc":"2.0","id":42,"method":"tools/list"}',
			endpoint,
			apiKey,
			fetchImpl,
			writeOut: (s) => out.push(s),
			writeErr: (s) => err.push(s),
		})
		const line = out.join('').trim()
		const parsed = JSON.parse(line) as { id: number; error: { code: number; message: string } }
		expect(parsed.id).toBe(42)
		expect(parsed.error.code).toBe(-32603)
		expect(parsed.error.message).toContain('ECONNREFUSED')
		expect(err.join('')).toContain('network error')
	})

	it('uses null id when the request line is not valid JSON', async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch
		const out: string[] = []
		await forward({
			message: 'not-json',
			endpoint,
			apiKey,
			fetchImpl,
			writeOut: (s) => out.push(s),
			writeErr: () => undefined,
		})
		const parsed = JSON.parse(out.join('').trim()) as { id: number | null }
		expect(parsed.id).toBeNull()
	})

	it('never throws, even on repeated failures', async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch
		const out: string[] = []
		for (let i = 0; i < 5; i++) {
			await expect(
				forward({
					message: `{"jsonrpc":"2.0","id":${i}}`,
					endpoint,
					apiKey,
					fetchImpl,
					writeOut: (s) => out.push(s),
					writeErr: () => undefined,
				}),
			).resolves.toBeUndefined()
		}
		expect(out).toHaveLength(5)
	})
})

// Forwarding logic extracted from bin.ts for testability. No Node runtime
// assumptions here — pure functions + a caller-supplied fetch/writer.

export interface ForwardOpts {
	message: string
	endpoint: string
	apiKey: string
	fetchImpl: typeof fetch
	writeOut: (chunk: string) => void
	writeErr: (chunk: string) => void
}

/**
 * Forward a single JSON-RPC line to the remote MCP endpoint and write the
 * response (or a synthetic error response) to `writeOut`. Never throws.
 */
export async function forward(opts: ForwardOpts): Promise<void> {
	try {
		const res = await opts.fetchImpl(opts.endpoint, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${opts.apiKey}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: opts.message,
		})
		const text = await res.text()
		opts.writeOut(text.endsWith('\n') ? text : `${text}\n`)
		if (!res.ok) {
			opts.writeErr(`[edgerouteai-mcp] HTTP ${res.status} from remote: ${text.slice(0, 200)}\n`)
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		let reqId: string | number | null = null
		try {
			const parsed = JSON.parse(opts.message) as { id?: string | number | null }
			if (parsed && (typeof parsed.id === 'string' || typeof parsed.id === 'number')) {
				reqId = parsed.id
			}
		} catch {
			// leave reqId as null
		}
		const errorResponse = JSON.stringify({
			jsonrpc: '2.0',
			id: reqId,
			error: {
				code: -32603,
				message: `Network error talking to mcp.edgerouteai.com: ${msg}`,
			},
		})
		opts.writeOut(`${errorResponse}\n`)
		opts.writeErr(`[edgerouteai-mcp] network error: ${msg}\n`)
	}
}

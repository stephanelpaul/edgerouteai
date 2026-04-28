#!/usr/bin/env node
// EdgeRouteAI MCP stdio bridge.
//
// Claude Desktop / Cursor / Cline / Continue all launch MCP servers as a local
// subprocess and talk to them over stdin/stdout using line-delimited JSON-RPC
// (per the MCP 2025-03-26 stdio transport spec). Our actual MCP server lives
// remotely at https://mcp.edgerouteai.com — this shim forwards each stdin
// message to that HTTP endpoint and prints the response to stdout.
//
// Usage (add to ~/Library/Application Support/Claude/claude_desktop_config.json):
//   {
//     "mcpServers": {
//       "edgerouteai": {
//         "command": "npx",
//         "args": ["-y", "@edgerouteai/mcp-stdio"],
//         "env": { "EDGEROUTEAI_API_KEY": "sk-er-..." }
//       }
//     }
//   }

import { createInterface } from 'node:readline'
import { forward } from './lib.js'

const API_KEY = process.env.EDGEROUTEAI_API_KEY
const ENDPOINT = process.env.EDGEROUTEAI_MCP_URL ?? 'https://mcp.edgerouteai.com/mcp'

if (!API_KEY) {
	console.error(
		'[edgerouteai-mcp] ERROR: EDGEROUTEAI_API_KEY environment variable is required.\n' +
			'Get your key at https://app.edgerouteai.com/dashboard/keys',
	)
	process.exit(1)
}

if (!API_KEY.startsWith('sk-er-')) {
	console.error('[edgerouteai-mcp] ERROR: EDGEROUTEAI_API_KEY looks wrong (expected sk-er-...).')
	process.exit(1)
}

// Prefer Node's built-in fetch (Node >= 18).
if (typeof fetch !== 'function') {
	console.error('[edgerouteai-mcp] ERROR: Node.js 20+ required (global fetch unavailable).')
	process.exit(1)
}

const rl = createInterface({ input: process.stdin, terminal: false })

rl.on('line', (line) => {
	const trimmed = line.trim()
	if (!trimmed) return
	// Fire-and-don't-await so messages pipeline. The remote server handles
	// concurrent requests; stdout writes are atomic per-line.
	void forward({
		message: trimmed,
		endpoint: ENDPOINT,
		apiKey: API_KEY as string,
		fetchImpl: fetch,
		writeOut: (chunk) => process.stdout.write(chunk),
		writeErr: (chunk) => process.stderr.write(chunk),
	})
})

rl.on('close', () => {
	// Parent process closed stdin. Drain any in-flight requests then exit.
	setTimeout(() => process.exit(0), 100)
})

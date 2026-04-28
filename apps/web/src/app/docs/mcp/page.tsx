import { CodeBlock, H1, H2, Lead, Note, P, UL } from '@/components/docs/prose'
import Link from 'next/link'

export default function McpPage() {
	return (
		<>
			<H1>MCP server</H1>
			<Lead>
				EdgeRouteAI exposes its routing as a Model Context Protocol server, so any MCP-aware client
				(Claude Desktop, Cursor, Cline, Continue, etc.) can call <code>auto</code> and the 11
				underlying providers without leaving the chat UI.
			</Lead>

			<H2 id="endpoints">Endpoints</H2>
			<UL>
				<li>
					<strong>Streamable HTTP</strong> (primary): <code>https://mcp.edgerouteai.com</code>.
					Single POST per request; SSE upgrade for streamed responses. Authorization:{' '}
					<code>Bearer edgrt_…</code>.
				</li>
				<li>
					<strong>Stdio shim</strong>: <code>npx -y @edgerouteai/mcp-stdio</code>. Wraps the HTTP
					transport for clients that only speak stdio (current Claude Desktop, older Cursor builds).
				</li>
			</UL>

			<H2 id="claude-desktop">Claude Desktop</H2>
			<P>
				Edit <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS
				(or the equivalent on Windows / Linux) and add:
			</P>
			<CodeBlock label="claude_desktop_config.json">{`{
  "mcpServers": {
    "edgerouteai": {
      "command": "npx",
      "args": ["-y", "@edgerouteai/mcp-stdio"],
      "env": { "EDGEROUTE_KEY": "edgrt_…" }
    }
  }
}`}</CodeBlock>

			<H2 id="cursor">Cursor / Cline</H2>
			<P>
				Both speak stdio MCP — same config shape as above, dropped into their respective MCP config
				files. The dashboard's{' '}
				<Link href="/dashboard/setup" className="text-purple-300 hover:text-purple-200 underline">
					Setup page
				</Link>{' '}
				generates a copy-paste version that bakes your key in.
			</P>

			<H2 id="protocol">Protocol surface</H2>
			<P>
				The server implements MCP <code>2024-11-05</code>. The exposed <code>tools/list</code>{' '}
				response contains a single tool, <code>chat</code>, that takes <code>model</code> and{' '}
				<code>messages</code> and proxies to the same gateway that <code>/v1/chat/completions</code>{' '}
				uses. Streaming is supported via SSE.
			</P>

			<Note>
				All routing logic — auto-routing, smart-router preferences, BYOK fallback, guardrails,
				analytics — applies identically whether you call via REST or MCP.
			</Note>
		</>
	)
}

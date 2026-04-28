import { CodeBlock, H1, H2, Lead, P, UL } from '@/components/docs/prose'
import Link from 'next/link'

export default function DocsIndex() {
	return (
		<>
			<H1>EdgeRouteAI docs</H1>
			<Lead>
				Open-source LLM gateway on Cloudflare's edge. One OpenAI-compatible endpoint for 11
				providers, with smart routing, MCP server, observability, and guardrails.
			</Lead>

			<H2>Five-minute path</H2>
			<P>
				If you've used the OpenAI SDK before, you're already 90% of the way there. The quickstart
				below shows the full happy path.
			</P>
			<CodeBlock label="curl">{`curl https://api.edgerouteai.com/v1/chat/completions \\
  -H "Authorization: Bearer $EDGEROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "auto",
    "messages": [{"role":"user","content":"Hello"}]
  }'`}</CodeBlock>

			<H2>What's in here</H2>
			<UL>
				<li>
					<Link href="/docs/quickstart" className="text-purple-300 hover:text-purple-200 underline">
						Quickstart
					</Link>{' '}
					— sign up, add a key, make a request.
				</li>
				<li>
					<Link href="/docs/auth" className="text-purple-300 hover:text-purple-200 underline">
						Authentication
					</Link>{' '}
					— how API keys work, sessions, retry / timeout knobs.
				</li>
				<li>
					<Link href="/docs/byok" className="text-purple-300 hover:text-purple-200 underline">
						BYOK setup
					</Link>{' '}
					— per-provider key formats, verification, label conventions.
				</li>
				<li>
					<Link href="/docs/mcp" className="text-purple-300 hover:text-purple-200 underline">
						MCP server
					</Link>{' '}
					— Streamable HTTP at <code>mcp.edgerouteai.com</code>, plus the stdio shim.
				</li>
				<li>
					<Link
						href="/docs/integrations"
						className="text-purple-300 hover:text-purple-200 underline"
					>
						Client integrations
					</Link>{' '}
					— Claude Desktop, Cursor, Cline, Continue, OpenAI SDKs, LangChain.
				</li>
				<li>
					<Link
						href="/docs/observability"
						className="text-purple-300 hover:text-purple-200 underline"
					>
						Observability
					</Link>{' '}
					— trace IDs, analytics, webhooks, exports.
				</li>
				<li>
					<Link href="/docs/guardrails" className="text-purple-300 hover:text-purple-200 underline">
						Guardrails
					</Link>{' '}
					— PII regex and keyword blocklists per API key.
				</li>
				<li>
					<Link
						href="/docs/api-reference"
						className="text-purple-300 hover:text-purple-200 underline"
					>
						API reference
					</Link>{' '}
					— endpoint catalog and response headers.
				</li>
				<li>
					<Link href="/docs/self-host" className="text-purple-300 hover:text-purple-200 underline">
						Self-hosting
					</Link>{' '}
					— run the open gateway on your own Cloudflare account.
				</li>
			</UL>
		</>
	)
}

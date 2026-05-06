import { CodeBlock, H1, H2, Lead, Note, OL, P } from '@/components/docs/prose'
import Link from 'next/link'

export default function QuickstartPage() {
	return (
		<>
			<H1>Quickstart</H1>
			<Lead>
				From "I have an account" to "I made a routed request" in under five minutes. No SDK switch —
				just change the base URL.
			</Lead>

			<H2 id="signup">1. Sign up</H2>
			<P>
				Create an account at{' '}
				<Link href="/signup" className="text-purple-300 hover:text-purple-200 underline">
					/signup
				</Link>
				. The first request to a fresh signup grants superadmin access to that user (you).
			</P>

			<H2 id="key">2. Create an API key</H2>
			<P>
				In the dashboard, go to <strong>API Keys → Create</strong>. Keys start with{' '}
				<code>edgrt_</code> and are shown <strong>only once</strong> at creation — copy it somewhere
				safe.
			</P>
			<Note kind="warn">
				Lost a key? Revoke it from the dashboard and create a new one. We never store the secret in
				plaintext, so we can't show it to you again.
			</Note>

			<H2 id="provider">3. Add a provider key (or top up credits)</H2>
			<P>Two options. Pick whichever fits how you want to handle billing:</P>
			<OL>
				<li>
					<strong>BYOK</strong> (recommended): paste a key for any of the 11 supported providers.
					First 1,000 requests/month are free, then $1/1,000 — paid in credits.
				</li>
				<li>
					<strong>Platform keys</strong>: top up credits ($5–$100), and EdgeRouteAI uses its own
					provider keys at a flat 2.5% markup over list price.
				</li>
			</OL>

			<H2 id="request">4. Make a request</H2>
			<P>
				The endpoint is <code>https://api.edgerouteai.com/v1/chat/completions</code>. Use the OpenAI
				SDK or any HTTP client. Pass <code>model: "auto"</code> to let the smart router pick — or
				specify any of the 11 providers explicitly (e.g. <code>anthropic/claude-sonnet-4-6</code>).
			</P>
			<CodeBlock label="JavaScript (OpenAI SDK)">{`import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.EDGEROUTE_KEY,
  baseURL: 'https://api.edgerouteai.com/v1',
})

const r = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: 'Hello' }],
})

console.log(r.choices[0].message.content)`}</CodeBlock>

			<CodeBlock label="Python (OpenAI SDK)">{`from openai import OpenAI

client = OpenAI(
    api_key=os.environ["EDGEROUTE_KEY"],
    base_url="https://api.edgerouteai.com/v1",
)

r = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
)`}</CodeBlock>

			<H2 id="next">What's next</H2>
			<OL>
				<li>
					Read{' '}
					<Link href="/docs/byok" className="text-purple-300 hover:text-purple-200 underline">
						BYOK setup
					</Link>{' '}
					to add keys for additional providers.
				</li>
				<li>
					Wire up{' '}
					<Link href="/docs/mcp" className="text-purple-300 hover:text-purple-200 underline">
						MCP
					</Link>{' '}
					if you want EdgeRoute available inside Claude Desktop, Cursor, or Cline.
				</li>
				<li>
					See{' '}
					<Link
						href="/docs/observability"
						className="text-purple-300 hover:text-purple-200 underline"
					>
						Observability
					</Link>{' '}
					for trace IDs and analytics.
				</li>
			</OL>
		</>
	)
}

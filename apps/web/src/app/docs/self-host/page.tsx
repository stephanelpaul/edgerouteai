import { CodeBlock, H1, H2, Lead, Note, OL, P, UL } from '@/components/docs/prose'

export default function SelfHostPage() {
	return (
		<>
			<H1>Self-hosting</H1>
			<Lead>
				The gateway is open source under FSL-1.1 and converts to Apache 2.0 two years after release.
				Run it on your own Cloudflare account; bring your own D1 + KV. The dashboard and Polar
				billing worker are <em>not</em> open — but you don't need them to run the gateway.
			</Lead>

			<H2 id="components">What's open vs closed</H2>
			<UL>
				<li>
					<strong>Open (FSL-1.1)</strong>: <code>apps/api</code>, <code>apps/mcp</code>,{' '}
					<code>packages/core</code>, <code>packages/db</code>, <code>packages/shared</code>,{' '}
					<code>packages/auth</code>, <code>packages/mcp-stdio</code>.
				</li>
				<li>
					<strong>Proprietary</strong>: <code>apps/web</code> (dashboard), <code>apps/billing</code>{' '}
					(Polar). You can build your own dashboard against the documented <code>/api/*</code>{' '}
					surface.
				</li>
			</UL>

			<H2 id="prereqs">Prerequisites</H2>
			<UL>
				<li>A Cloudflare account with Workers + D1 + KV enabled.</li>
				<li>
					<code>node 20+</code>, <code>pnpm 9+</code>, <code>wrangler 3+</code>.
				</li>
				<li>
					An encryption key (32 random bytes, base64-encoded) for at-rest provider key encryption.
				</li>
			</UL>

			<H2 id="setup">Setup</H2>
			<OL>
				<li>
					<code>git clone https://github.com/stephanelpaul/edgerouteai && cd edgerouteai</code>
				</li>
				<li>
					<code>pnpm install</code>
				</li>
				<li>
					Provision a D1 database and a KV namespace from the Cloudflare dashboard. Note their IDs;
					paste them into <code>apps/api/wrangler.toml</code>.
				</li>
				<li>
					Apply migrations:{' '}
					<code>cd apps/api && npx wrangler d1 migrations apply edgerouteai-db --remote</code>
				</li>
				<li>
					Set the encryption key: <code>npx wrangler secret put ENCRYPTION_KEY</code>
				</li>
				<li>
					<code>npx wrangler deploy</code>
				</li>
			</OL>

			<H2 id="config">Configuration</H2>
			<P>Environment variables the worker reads:</P>
			<CodeBlock label="wrangler.toml [vars]">{`[vars]
ENVIRONMENT = "production"
SMART_ROUTER_LLM = "1"   # opt in to LLM classifier (uses one of your BYOK keys)`}</CodeBlock>
			<P>Bindings:</P>
			<UL>
				<li>
					<code>DB</code> — D1 (run migrations from <code>packages/db/src/migrations</code>).
				</li>
				<li>
					<code>RATE_LIMIT</code> — KV namespace for rate-limit + health-tracker state.
				</li>
				<li>
					<code>CACHE</code> — KV namespace for content-hash cache + classifier cache.
				</li>
			</UL>
			<P>
				Secrets (set via <code>wrangler secret put</code>):
			</P>
			<UL>
				<li>
					<code>ENCRYPTION_KEY</code> — 32 random bytes, base64.
				</li>
			</UL>

			<H2 id="dashboard">Dashboard</H2>
			<P>The hosted dashboard is closed-source. You have two options for self-hosting:</P>
			<UL>
				<li>
					Build your own UI against the <code>/api/*</code> endpoints (documented in API reference).
					Hono routes are simple and well-typed.
				</li>
				<li>
					Skip a UI entirely and drive the gateway via API key + <code>curl</code> / <code>jq</code>
					. The CLI flow is enough for many self-hosters.
				</li>
			</UL>

			<Note>
				FSL converts to Apache 2.0 on 2028-04-22. Until then, the license permits non-competing
				internal and SaaS use; specifically prohibits offering EdgeRoute itself as a hosted
				commercial service.
			</Note>
		</>
	)
}

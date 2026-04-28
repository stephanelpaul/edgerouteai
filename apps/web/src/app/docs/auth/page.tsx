import { CodeBlock, H1, H2, Lead, Note, P, UL } from '@/components/docs/prose'

export default function AuthPage() {
	return (
		<>
			<H1>Authentication</H1>
			<Lead>
				Two ways to talk to the gateway: an API key for programmatic clients, or a session cookie
				for the dashboard. The proxy at <code>/v1/*</code> only accepts API keys.
			</Lead>

			<H2 id="api-keys">API keys</H2>
			<P>
				Keys are stored as a hash + last-4 prefix in D1. The full secret is shown once at creation
				and never again. Pass it as a Bearer token:
			</P>
			<CodeBlock>{'Authorization: Bearer edgrt_…'}</CodeBlock>
			<P>Each key has its own knobs you can tune from the dashboard:</P>
			<UL>
				<li>
					<strong>Rate limit</strong> — requests per minute, enforced via Cloudflare KV.
				</li>
				<li>
					<strong>Retry count</strong> — gateway retries on 429 / 5xx (exponential backoff).
				</li>
				<li>
					<strong>Timeout</strong> — request deadline in ms. Aborts the upstream call.
				</li>
				<li>
					<strong>Model restrictions</strong> — optional allowlist of model strings.
				</li>
				<li>
					<strong>Budget</strong> — monthly $ ceiling; once hit, requests 429.
				</li>
			</UL>

			<H2 id="sessions">Dashboard sessions</H2>
			<P>
				The dashboard at <code>edgerouteai.com/dashboard</code> uses better-auth cookie sessions.
				The <code>/api/*</code> management routes accept either a session cookie or an API key, so
				you can script the dashboard endpoints from the CLI if you want.
			</P>

			<H2 id="superadmin">Superadmin</H2>
			<P>
				The first user to sign up is granted the <code>superadmin</code> role. They get access to{' '}
				<code>/dashboard/admin</code> for managing platform-key pool entries and inspecting global
				usage.
			</P>

			<H2 id="best-practices">Best practices</H2>
			<UL>
				<li>One key per environment / per app. Never reuse a prod key in CI.</li>
				<li>Rotate keys on a schedule. Revocation is instant — old ones return 401 immediately.</li>
				<li>
					Set a budget on every key. The free 1K BYOK requests/month don't protect you from a
					runaway loop calling Opus.
				</li>
			</UL>

			<Note>
				The gateway never logs full keys, request bodies, or response content. Only metadata (model,
				tokens, latency, cost) is persisted.
			</Note>
		</>
	)
}

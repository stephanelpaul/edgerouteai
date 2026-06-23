import { CodeBlock, H1, H2, H3, Lead, P, UL } from '@/components/docs/prose'

export default function ApiReferencePage() {
	return (
		<>
			<H1>API reference</H1>
			<Lead>
				Two surfaces. The proxy at <code>/v1/*</code> is OpenAI-compatible and authenticated by API
				key. The management API at <code>/api/*</code> drives the dashboard and accepts session or
				API-key auth.
			</Lead>

			<H2 id="base">Base URLs</H2>
			<UL>
				<li>
					<strong>REST gateway</strong>: <code>https://api.edgerouteai.com</code>
				</li>
				<li>
					<strong>MCP server</strong>: <code>https://mcp.edgerouteai.com</code>
				</li>
				<li>
					<strong>Dashboard / management</strong>: <code>https://api.edgerouteai.com/api</code>
				</li>
			</UL>

			<H2 id="proxy">Proxy endpoints</H2>

			<H3 id="chat-completions">
				<code>POST /v1/chat/completions</code>
			</H3>
			<P>OpenAI-compatible chat completions. Streaming is on by default. Notable knobs:</P>
			<UL>
				<li>
					<code>model</code> — any of the 11 supported provider/model strings, or <code>auto</code>{' '}
					/ <code>auto/quality</code> / <code>auto/balanced</code> / <code>auto/budget</code> /{' '}
					<code>auto/auto</code>.
				</li>
				<li>
					Standard params (<code>temperature</code>, <code>max_tokens</code>, <code>stream</code>,
					etc.) pass through unchanged.
				</li>
			</UL>
			<P>Response sets these EdgeRoute-specific headers:</P>
			<CodeBlock>{`X-EdgeRoute-Trace-Id:    <uuid>
X-EdgeRoute-Provider:    openai | anthropic | …
X-EdgeRoute-Model:       gpt-5 | claude-sonnet-4-6 | …
X-EdgeRoute-Auto-Reason: <human-readable reason if model=auto>
X-EdgeRoute-Cache:       HIT | MISS`}</CodeBlock>

			<H2 id="management">Management endpoints</H2>
			<P>
				All <code>/api/*</code> routes accept session cookie OR <code>Authorization: Bearer</code>{' '}
				API key. JSON in, JSON out. Errors share a structured shape:
			</P>
			<CodeBlock>{`{ "error": { "type": "edgeroute_error", "code": "<code>", "message": "<msg>" } }`}</CodeBlock>

			<H3>Catalog</H3>
			<UL>
				<li>
					<code>GET/POST/DELETE /api/keys</code> — manage API keys.
				</li>
				<li>
					<code>GET/POST/DELETE /api/providers</code> — BYOK provider keys.
				</li>
				<li>
					<code>POST /api/providers/:id/verify</code> — sanity-check a key against the upstream.
				</li>
				<li>
					<code>GET/POST/PUT/DELETE /api/routing</code> — fallback chains.
				</li>
				<li>
					<code>GET/PUT/DELETE /api/router-prefs</code> — smart-router pin/exclude/¢-cap (per-user /
					per-key).
				</li>
				<li>
					<code>GET/POST/DELETE /api/aliases</code> — model aliases.
				</li>
				<li>
					<code>GET/POST/PUT/DELETE /api/budgets</code> — monthly $ budgets per API key.
				</li>
				<li>
					<code>GET/POST/PUT/DELETE /api/webhooks</code> — outbound webhooks.
				</li>
				<li>
					<code>GET/POST/PUT/DELETE /api/transforms</code> — request transforms (prepend/append
					system, set parameter).
				</li>
				<li>
					<code>GET/POST/PUT/DELETE /api/guardrails</code> — input-scope guardrails per key.
				</li>
				<li>
					<code>GET /api/stats</code>, <code>GET /api/analytics</code>, <code>GET /api/logs</code> —
					usage data.
				</li>
				<li>
					<code>GET /api/export/stats?format=csv&days=N</code> — CSV export.
				</li>
				<li>
					<code>GET /api/account</code> — current user, credit balance.
				</li>
				<li>
					<code>GET/POST /api/admin/*</code> — superadmin only.
				</li>
			</UL>

			<H2 id="errors">Error codes</H2>
			<UL>
				<li>
					<code>invalid_api_key</code> — bad / revoked key.
				</li>
				<li>
					<code>rate_limited</code> — per-key RPM exceeded.
				</li>
				<li>
					<code>budget_exceeded</code> — monthly $ ceiling hit.
				</li>
				<li>
					<code>insufficient_credits</code> — platform-key path, balance ≤ 0.
				</li>
				<li>
					<code>provider_key_missing</code> — auto-router has no key for the chosen provider.
				</li>
				<li>
					<code>model_not_found</code> — unknown model string.
				</li>
				<li>
					<code>guardrail_blocked</code> — request matched an active guardrail.
				</li>
			</UL>
		</>
	)
}

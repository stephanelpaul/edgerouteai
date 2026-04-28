import { CodeBlock, H1, H2, Lead, P, UL } from '@/components/docs/prose'
import Link from 'next/link'

export default function ObservabilityPage() {
	return (
		<>
			<H1>Observability</H1>
			<Lead>
				Per-request trace IDs, cost / latency / token analytics, webhooks, and CSV exports. Designed
				so you can correlate EdgeRoute logs with your own observability stack.
			</Lead>

			<H2 id="trace-ids">Trace IDs</H2>
			<P>Every chat completion gets a UUID v4 trace ID, surfaced in the response header:</P>
			<CodeBlock>{'X-EdgeRoute-Trace-Id: 9f2c4e1d-…'}</CodeBlock>
			<P>
				The same UUID is used as the <code>request_logs.id</code> primary key, so you can
				cross-reference a customer-reported error to the gateway log row in one query.
			</P>

			<H2 id="response-headers">Response headers</H2>
			<P>The proxy sets a handful of headers worth alerting on:</P>
			<UL>
				<li>
					<code>X-EdgeRoute-Provider</code> / <code>X-EdgeRoute-Model</code> — which upstream
					actually served the request.
				</li>
				<li>
					<code>X-EdgeRoute-Auto-Reason</code> — human-readable explanation when{' '}
					<code>model: "auto"</code> was used (e.g. "Detected coding task →
					anthropic/claude-sonnet-4-6").
				</li>
				<li>
					<code>X-EdgeRoute-Cache</code> — <code>HIT</code> or <code>MISS</code> for the
					content-hash cache.
				</li>
			</UL>

			<H2 id="dashboard">Dashboard</H2>
			<P>
				The{' '}
				<Link
					href="/dashboard/analytics"
					className="text-purple-300 hover:text-purple-200 underline"
				>
					Analytics page
				</Link>{' '}
				shows tokens, cost, latency, and request volume over rolling windows, broken down by
				provider and model. Use{' '}
				<Link href="/dashboard/logs" className="text-purple-300 hover:text-purple-200 underline">
					Logs
				</Link>{' '}
				to inspect individual requests by trace ID.
			</P>

			<H2 id="webhooks">Webhooks</H2>
			<P>Two events fire today, signed via HMAC-SHA256 if a secret is set:</P>
			<UL>
				<li>
					<code>request.completed</code> — fires after every successful request with provider,
					model, tokens, cost, latency.
				</li>
				<li>
					<code>budget.exceeded</code> — fires when an API key crosses its monthly budget.
				</li>
				<li>
					<code>credits.exhausted</code> — fires when a platform-key debit can't be satisfied.
				</li>
			</UL>

			<H2 id="export">CSV exports</H2>
			<P>
				The dashboard's <strong>Export Stats</strong> button hits{' '}
				<code>/api/export/stats?format=csv&days=N</code> and streams a CSV of the rolling window.
				Useful for ad-hoc analysis in a spreadsheet.
			</P>
		</>
	)
}

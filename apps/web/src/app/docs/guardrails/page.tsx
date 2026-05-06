import { CodeBlock, H1, H2, Lead, Note, P, UL } from '@/components/docs/prose'

export default function GuardrailsPage() {
	return (
		<>
			<H1>Guardrails</H1>
			<Lead>
				PII regex and keyword blocklists scoped to each API key. Guardrails fire before the upstream
				call — a blocked request never reaches the provider, so you don't pay for it and the prompt
				isn't leaked.
			</Lead>

			<H2 id="scope">Scope (today)</H2>
			<UL>
				<li>
					<strong>Input only.</strong> The MVP scans <code>messages[]</code>, not the assistant's
					response.
				</li>
				<li>
					<strong>Per-API-key.</strong> Each key can have its own active guardrails.
				</li>
				<li>
					<strong>Two checker types</strong>: regex (good for PII) and exact keyword match (good for
					compliance / brand-safety).
				</li>
			</UL>

			<Note kind="warn">
				v2 will add output stream scanning, an LLM-based classifier, and a webhook-veto flow. The
				schema is forward-compatible — existing rows stay valid.
			</Note>

			<H2 id="config">Config shape</H2>
			<P>
				Guardrails are stored as a <code>config</code> JSON blob with this structure:
			</P>
			<CodeBlock label="JSON">{`{
  "rules": [
    { "type": "pii_regex", "pattern": "\\\\b\\\\d{3}-\\\\d{2}-\\\\d{4}\\\\b", "category": "ssn" },
    { "type": "keyword", "words": ["confidential", "internal-only"], "case_sensitive": false }
  ]
}`}</CodeBlock>

			<H2 id="behavior">When a rule matches</H2>
			<P>The gateway returns a 400 with a structured error:</P>
			<CodeBlock>{`{
  "error": {
    "type": "edgeroute_error",
    "code": "guardrail_blocked",
    "message": "Request blocked by guardrail (pii_regex: ssn). Excerpt: \\"123-45-6789\\""
  }
}`}</CodeBlock>
			<P>
				The match is logged (with redacted excerpt) but the prompt is never persisted in full.
				Guardrail-blocked requests don't count against your monthly BYOK fee.
			</P>

			<H2 id="dashboard-session">Dashboard session bypass</H2>
			<P>
				Requests authenticated by the dashboard session (i.e. the playground at{' '}
				<code>/dashboard/chat</code>) skip guardrails. The reasoning: the user is already the one
				typing the prompt, so blocking themselves makes no sense.
			</P>
		</>
	)
}

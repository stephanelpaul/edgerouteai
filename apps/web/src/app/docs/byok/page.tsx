import { CodeBlock, H1, H2, H3, Lead, Note, P, UL } from '@/components/docs/prose'

export default function ByokPage() {
	return (
		<>
			<H1>BYOK setup</H1>
			<Lead>
				Bring your own provider keys for zero markup. Add as many as you want — the smart router can
				fall through them in order, and per-key user preferences (pin / exclude / ¢-cap) apply.
			</Lead>

			<H2 id="add">Adding a key</H2>
			<P>
				In the dashboard, go to <strong>Providers → [provider] → Add</strong>. Keys are encrypted
				with AES-GCM before they hit D1; the encryption key lives in the worker's secret store, not
				the database.
			</P>

			<Note>
				After adding a key, click <strong>Verify</strong>. The dashboard makes a tiny test call to
				confirm the key is valid before the auto-router relies on it.
			</Note>

			<H2 id="providers">Per-provider details</H2>

			<H3 id="openai">OpenAI</H3>
			<P>
				Keys start with <code>sk-…</code>. Get one at platform.openai.com.
			</P>

			<H3 id="anthropic">Anthropic</H3>
			<P>
				Keys start with <code>sk-ant-…</code>. Console at console.anthropic.com.
			</P>

			<H3 id="google">Google (Gemini)</H3>
			<P>
				Use a Generative Language API key from Google AI Studio. EdgeRoute uses the SSE streaming
				endpoint (<code>streamGenerateContent</code>) so the auto-router and health tracker work
				uniformly with the OpenAI-compatible providers.
			</P>

			<H3 id="mistral">Mistral</H3>
			<P>
				Console at console.mistral.ai. EdgeRoute supports <code>mistral-large-latest</code>,{' '}
				<code>mistral-medium-latest</code>, <code>mistral-small-latest</code>.
			</P>

			<H3 id="xai">xAI</H3>
			<P>
				Keys start with <code>xai-…</code>. Default model: <code>grok-4.20</code>.
			</P>

			<H3 id="groq">Groq</H3>
			<P>Get a key at console.groq.com. Llama, Mixtral, and Qwen-Coder are all supported.</P>

			<H3 id="together">Together AI</H3>
			<P>api.together.xyz. Same OpenAI-compatible shape; cheap Llama / Qwen-Coder hosting.</P>

			<H3 id="cloudflare">Cloudflare Workers AI</H3>
			<P>
				Two values: an account ID and an API token with the Workers AI scope. The dashboard asks for
				both; we store them combined as one credential.
			</P>

			<H3 id="cohere">Cohere</H3>
			<P>
				dashboard.cohere.com. Recent <code>command-r</code> and <code>command-r-plus</code> are
				supported.
			</P>

			<H3 id="ollama">Ollama (self-hosted)</H3>
			<P>
				Ollama doesn't really have keys — it has a base URL. Paste the URL of your Ollama instance
				into the key field, prefixed with <code>url:</code>:
			</P>
			<CodeBlock>{'url:https://ollama.your-internal.example/api'}</CodeBlock>
			<P>
				The gateway will POST to <code>{'<that URL>/chat'}</code> with stream:true. No bearer token
				is sent.
			</P>

			<H3 id="azure">Azure OpenAI</H3>
			<P>Azure needs a deployment-prefixed URL plus an API key. Paste them combined:</P>
			<CodeBlock>
				{'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT|YOUR-KEY'}
			</CodeBlock>

			<H2 id="costs">What you pay</H2>
			<UL>
				<li>
					<strong>Tokens</strong>: billed by the provider, not by us. We never see your bill.
				</li>
				<li>
					<strong>Platform fee</strong>: free for the first 1,000 requests/month, then $1/1,000 (1¢
					per 10 requests over the threshold), debited from your credit balance.
				</li>
			</UL>
		</>
	)
}

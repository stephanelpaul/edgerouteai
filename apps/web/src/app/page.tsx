import { CodeTabs } from '@/components/landing/code-tabs'
import Link from 'next/link'

const PROVIDERS = [
	'OpenAI',
	'Anthropic',
	'Google',
	'Mistral',
	'xAI',
	'Groq',
	'Together AI',
	'Cloudflare Workers AI',
	'Cohere',
	'Ollama',
	'Azure OpenAI',
]

const FEATURES = [
	{
		title: 'Smart routing',
		body: 'Auto-pick the cheapest model that meets your latency, context, and quality bar. Pin or exclude providers per API key.',
	},
	{
		title: 'BYOK or platform keys',
		body: "Use your own provider keys for zero markup, or top up credits and we'll cover the keys at a flat 2.5% fee.",
	},
	{
		title: 'OpenAI-compatible',
		body: 'Drop-in replacement for the OpenAI SDK. Switch base URL, keep your code.',
	},
	{
		title: 'MCP server',
		body: 'Native Streamable-HTTP and stdio shim for Claude Desktop, Cursor, Cline, and any MCP-aware client.',
	},
	{
		title: 'Observability',
		body: 'Per-request trace IDs, cost / latency / token analytics, webhooks, exports — without giving up your data.',
	},
	{
		title: 'Guardrails',
		body: 'PII regex and keyword blocklists scoped to each API key. Tighten the perimeter without changing app code.',
	},
]

const COMPARISON: Array<{
	feature: string
	edge: string
	openrouter: string
	direct: string
}> = [
	{
		feature: 'BYOK supported',
		edge: 'Yes — zero markup on your keys',
		openrouter: 'Limited',
		direct: 'N/A',
	},
	{
		feature: 'Smart auto-router',
		edge: 'Cost + context + health-aware',
		openrouter: 'Basic',
		direct: 'No',
	},
	{
		feature: 'MCP server',
		edge: 'HTTP + stdio shim',
		openrouter: 'No',
		direct: 'Varies',
	},
	{
		feature: 'Self-host (FSL → Apache 2.0)',
		edge: 'Yes — gateway is open',
		openrouter: 'No',
		direct: 'N/A',
	},
	{
		feature: 'Per-key pin / exclude / cost cap',
		edge: 'Yes',
		openrouter: 'No',
		direct: 'No',
	},
	{
		feature: 'Edge runtime',
		edge: 'Cloudflare Workers',
		openrouter: 'Origin servers',
		direct: 'Varies',
	},
]

export default function HomePage() {
	return (
		<main className="min-h-screen">
			<header className="sticky top-0 z-30 backdrop-blur bg-neutral-950/70 border-b border-neutral-900">
				<nav className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
					<Link href="/" className="font-bold tracking-tight text-lg">
						EdgeRouteAI
					</Link>
					<div className="flex items-center gap-3 text-sm">
						<a
							href="https://github.com/stephanelpaul/edgerouteai"
							className="hidden sm:inline text-neutral-400 hover:text-neutral-200 transition"
						>
							GitHub
						</a>
						<Link
							href="/dashboard"
							className="hidden sm:inline text-neutral-400 hover:text-neutral-200 transition"
						>
							Dashboard
						</Link>
						<Link
							href="/signup"
							className="rounded-lg bg-purple-600 px-3.5 py-1.5 font-medium text-white hover:bg-purple-500 transition"
						>
							Get started
						</Link>
					</div>
				</nav>
			</header>

			{/* Hero */}
			<section className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
				<div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-3 py-1 text-xs text-neutral-400">
					<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 11 providers, one
					OpenAI-compatible endpoint
				</div>
				<h1 className="mt-6 text-5xl sm:text-6xl font-bold tracking-tight">
					LLM routing that <span className="text-purple-400">keeps your bill honest</span>.
				</h1>
				<p className="mx-auto mt-6 max-w-2xl text-xl text-neutral-400">
					Open-source LLM gateway on Cloudflare's edge. Bring your own keys for zero markup, or top
					up credits and we cover the providers. Smart routing, MCP server, full observability — no
					vendor lock-in.
				</p>
				<div className="mt-8 flex gap-3 justify-center">
					<Link
						href="/signup"
						className="rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-500 transition"
					>
						Start free
					</Link>
					<a
						href="#code"
						className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-900 transition"
					>
						Show me the code
					</a>
				</div>
				<p className="mt-3 text-xs text-neutral-500">
					First 1,000 BYOK requests free every month. No credit card to try.
				</p>
			</section>

			{/* Drop-in code */}
			<section id="code" className="mx-auto max-w-3xl px-4 pb-20">
				<h2 className="mb-4 text-sm uppercase tracking-wider text-neutral-500">
					Drop-in replacement
				</h2>
				<CodeTabs />
				<p className="mt-3 text-sm text-neutral-500">
					Same OpenAI SDK calls. Pass <code className="text-neutral-300">model: "auto"</code> and we
					route to the best provider for the prompt — or pick any of the 11 below explicitly.
				</p>
			</section>

			{/* Provider list */}
			<section className="mx-auto max-w-5xl px-4 pb-20">
				<h2 className="mb-6 text-center text-sm uppercase tracking-wider text-neutral-500">
					Works with the providers you already use
				</h2>
				<div className="flex flex-wrap justify-center gap-2">
					{PROVIDERS.map((name) => (
						<span
							key={name}
							className="rounded-full border border-neutral-800 bg-neutral-900/50 px-3 py-1 text-sm text-neutral-300"
						>
							{name}
						</span>
					))}
				</div>
			</section>

			{/* Features grid */}
			<section className="mx-auto max-w-6xl px-4 pb-24">
				<div className="grid gap-6 md:grid-cols-3">
					{FEATURES.map((f) => (
						<div
							key={f.title}
							className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6"
						>
							<h3 className="font-semibold text-lg">{f.title}</h3>
							<p className="mt-2 text-sm text-neutral-400 leading-relaxed">{f.body}</p>
						</div>
					))}
				</div>
			</section>

			{/* Pricing */}
			<section id="pricing" className="mx-auto max-w-6xl px-4 pb-24">
				<div className="text-center">
					<h2 className="text-3xl font-bold tracking-tight">Simple, predictable pricing.</h2>
					<p className="mt-3 text-neutral-400">Pay providers directly, or top up credits.</p>
				</div>
				<div className="mt-10 grid gap-6 md:grid-cols-3">
					<PricingCard
						title="BYOK"
						headline="Free first 1K req/mo"
						subline="Then $1 per 1,000 requests"
						highlights={[
							'Use your own provider keys',
							'Zero markup on tokens',
							'Smart router included',
							'MCP + observability included',
						]}
						cta={{ label: 'Add a key', href: '/signup' }}
					/>
					<PricingCard
						title="Platform keys"
						headline="2.5% markup"
						subline="No own keys needed — pay from credits"
						highlights={[
							'Top up $5 / $20 / $50 / $100',
							'No expiry on credits',
							'We handle provider quotas + retries',
							'Same router, same observability',
						]}
						cta={{ label: 'Top up credits', href: '/signup' }}
						featured
					/>
					<PricingCard
						title="Self-host"
						headline="Free, FSL → Apache 2.0"
						subline="Run the open gateway on your Cloudflare account"
						highlights={[
							'Source available now (FSL-1.1)',
							'Converts to Apache 2.0 in 2 yrs',
							'No usage caps',
							'Bring your own D1 + KV',
						]}
						cta={{
							label: 'Read on GitHub',
							href: 'https://github.com/stephanelpaul/edgerouteai',
						}}
					/>
				</div>
			</section>

			{/* Comparison */}
			<section className="mx-auto max-w-6xl px-4 pb-24">
				<h2 className="text-center text-3xl font-bold tracking-tight">
					Why EdgeRouteAI vs. the alternatives
				</h2>
				<div className="mt-8 overflow-x-auto rounded-xl border border-neutral-800">
					<table className="min-w-full text-sm">
						<thead className="bg-neutral-900/60 text-neutral-400">
							<tr>
								<th className="px-4 py-3 text-left font-medium">Feature</th>
								<th className="px-4 py-3 text-left font-medium text-purple-300">EdgeRouteAI</th>
								<th className="px-4 py-3 text-left font-medium">OpenRouter</th>
								<th className="px-4 py-3 text-left font-medium">Direct provider</th>
							</tr>
						</thead>
						<tbody>
							{COMPARISON.map((row, idx) => (
								<tr
									key={row.feature}
									className={idx % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/30'}
								>
									<td className="px-4 py-3 text-neutral-300">{row.feature}</td>
									<td className="px-4 py-3 text-neutral-100">{row.edge}</td>
									<td className="px-4 py-3 text-neutral-400">{row.openrouter}</td>
									<td className="px-4 py-3 text-neutral-400">{row.direct}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{/* Final CTA */}
			<section className="mx-auto max-w-3xl px-4 pb-24 text-center">
				<h2 className="text-3xl font-bold tracking-tight">Ship in five minutes.</h2>
				<p className="mt-3 text-neutral-400">
					Sign up, paste an API key, and switch your base URL. The first 1,000 requests this month
					are on us.
				</p>
				<div className="mt-6 flex gap-3 justify-center">
					<Link
						href="/signup"
						className="rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-500 transition"
					>
						Get started
					</Link>
					<a
						href="https://github.com/stephanelpaul/edgerouteai"
						className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-900 transition"
					>
						Star on GitHub
					</a>
				</div>
			</section>

			<footer className="border-t border-neutral-900 py-10">
				<div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-neutral-500">
					<span>© 2026 EdgeRouteAI · FSL-1.1 (gateway), proprietary (dashboard)</span>
					<div className="flex gap-4">
						<a
							href="https://github.com/stephanelpaul/edgerouteai"
							className="hover:text-neutral-300"
						>
							GitHub
						</a>
						<Link href="/dashboard" className="hover:text-neutral-300">
							Dashboard
						</Link>
						<Link href="/login" className="hover:text-neutral-300">
							Sign in
						</Link>
					</div>
				</div>
			</footer>
		</main>
	)
}

function PricingCard({
	title,
	headline,
	subline,
	highlights,
	cta,
	featured = false,
}: {
	title: string
	headline: string
	subline: string
	highlights: string[]
	cta: { label: string; href: string }
	featured?: boolean
}) {
	return (
		<div
			className={`rounded-xl border p-6 ${
				featured
					? 'border-purple-700 bg-purple-950/20 ring-1 ring-purple-800'
					: 'border-neutral-800 bg-neutral-900/30'
			}`}
		>
			<div className="flex items-baseline justify-between">
				<h3 className="text-lg font-semibold">{title}</h3>
				{featured ? (
					<span className="rounded-full bg-purple-700/40 px-2 py-0.5 text-xs text-purple-200">
						Most popular
					</span>
				) : null}
			</div>
			<p className="mt-3 text-2xl font-bold tracking-tight">{headline}</p>
			<p className="text-sm text-neutral-500">{subline}</p>
			<ul className="mt-5 space-y-2 text-sm text-neutral-300">
				{highlights.map((h) => (
					<li key={h} className="flex gap-2">
						<span className="text-purple-400">→</span>
						<span>{h}</span>
					</li>
				))}
			</ul>
			<Link
				href={cta.href}
				className={`mt-6 block rounded-lg px-4 py-2.5 text-center font-medium transition ${
					featured
						? 'bg-purple-600 text-white hover:bg-purple-500'
						: 'border border-neutral-700 text-neutral-200 hover:bg-neutral-900'
				}`}
			>
				{cta.label}
			</Link>
		</div>
	)
}

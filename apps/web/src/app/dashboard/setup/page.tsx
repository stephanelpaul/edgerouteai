'use client'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface ApiKey {
	id: string
	name: string
	keyPrefix: string
	revokedAt?: string
}

interface ProviderKey {
	id: string
	provider: string
}

interface Account {
	creditsCents?: number
}

type ClientId = 'claude-desktop' | 'cursor' | 'cline' | 'continue' | 'openai-js' | 'openai-py'

const CLIENT_OPTIONS: Array<{ id: ClientId; label: string; sub: string }> = [
	{ id: 'claude-desktop', label: 'Claude Desktop', sub: 'MCP via stdio shim' },
	{ id: 'cursor', label: 'Cursor', sub: 'MCP via stdio shim' },
	{ id: 'cline', label: 'Cline (VS Code)', sub: 'MCP via stdio shim' },
	{ id: 'continue', label: 'Continue (VS Code)', sub: 'OpenAI-compatible custom provider' },
	{ id: 'openai-js', label: 'OpenAI SDK (JavaScript)', sub: 'Just swap the baseURL' },
	{ id: 'openai-py', label: 'OpenAI SDK (Python)', sub: 'Just swap the base_url' },
]

const KEY_PLACEHOLDER = '<YOUR_EDGEROUTE_KEY>'

function buildConfig(client: ClientId, key: string): string {
	switch (client) {
		case 'claude-desktop':
		case 'cursor':
		case 'cline':
			return JSON.stringify(
				{
					mcpServers: {
						edgerouteai: {
							command: 'npx',
							args: ['-y', '@edgerouteai/mcp-stdio'],
							env: { EDGEROUTE_KEY: key },
						},
					},
				},
				null,
				2,
			)
		case 'continue':
			return JSON.stringify(
				{
					models: [
						{
							title: 'EdgeRouteAI auto',
							provider: 'openai',
							model: 'auto',
							apiBase: 'https://api.edgerouteai.com/v1',
							apiKey: key,
						},
					],
				},
				null,
				2,
			)
		case 'openai-js':
			return [
				"import OpenAI from 'openai'",
				'',
				'const client = new OpenAI({',
				`  apiKey: '${key}',`,
				"  baseURL: 'https://api.edgerouteai.com/v1',",
				'})',
				'',
				'const r = await client.chat.completions.create({',
				"  model: 'auto',",
				"  messages: [{ role: 'user', content: 'Hello' }],",
				'})',
			].join('\n')
		case 'openai-py':
			return [
				'from openai import OpenAI',
				'',
				'client = OpenAI(',
				`    api_key="${key}",`,
				'    base_url="https://api.edgerouteai.com/v1",',
				')',
				'',
				'r = client.chat.completions.create(',
				'    model="auto",',
				'    messages=[{"role": "user", "content": "Hello"}],',
				')',
			].join('\n')
	}
}

export default function SetupPage() {
	const { apiUrl, isAuthenticated } = useAuth()
	const [keys, setKeys] = useState<ApiKey[]>([])
	const [providers, setProviders] = useState<ProviderKey[]>([])
	const [account, setAccount] = useState<Account | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	const [client, setClient] = useState<ClientId>('claude-desktop')
	const [keyValue, setKeyValue] = useState('')
	const [copied, setCopied] = useState(false)

	const load = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const [keysRes, provRes, acctRes] = await Promise.all([
				fetch(`${apiUrl}/api/keys`, { credentials: 'include' }),
				fetch(`${apiUrl}/api/providers`, { credentials: 'include' }),
				fetch(`${apiUrl}/api/account`, { credentials: 'include' }),
			])
			const [keysData, provData, acctData] = await Promise.all([
				keysRes.json(),
				provRes.json(),
				acctRes.ok ? acctRes.json() : Promise.resolve(null),
			])
			if (!keysRes.ok)
				throw new Error(
					(keysData as { error?: { message?: string } }).error?.message ??
						`Error ${keysRes.status}`,
				)
			setKeys(((keysData as { keys?: ApiKey[] }).keys ?? []).filter((k) => !k.revokedAt))
			setProviders((provData as { keys?: ProviderKey[] }).keys ?? [])
			setAccount(acctData as Account | null)
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setLoading(false)
		}
	}, [apiUrl])

	useEffect(() => {
		if (isAuthenticated) load()
	}, [isAuthenticated, load])

	const hasKey = keys.length > 0
	const hasProviderOrCredits =
		providers.length > 0 || (account?.creditsCents !== undefined && account.creditsCents > 0)
	const hasMadeRequest = false // We don't track this client-side; rendered as informational only.

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(buildConfig(client, keyValue || KEY_PLACEHOLDER))
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			// Sandboxed previews may block clipboard; silently no-op.
		}
	}

	if (!isAuthenticated) {
		return <p className="text-neutral-500">Please sign in to access this page.</p>
	}

	const config = buildConfig(client, keyValue || KEY_PLACEHOLDER)

	return (
		<div>
			<div>
				<h1 className="text-2xl font-bold">Setup</h1>
				<p className="mt-1 text-neutral-400">Three steps to your first request.</p>
			</div>

			{error && <p className="mt-4 text-sm text-red-400">{error}</p>}

			<ol className="mt-8 space-y-3 max-w-3xl">
				<Step
					n={1}
					done={hasKey}
					title="Create an API key"
					body="EdgeRoute keys start with edgrt_… and are shown only once at creation."
					cta={{ label: hasKey ? 'Manage keys' : 'Create key', href: '/dashboard/keys' }}
				/>
				<Step
					n={2}
					done={hasProviderOrCredits}
					title="Add a provider key or top up credits"
					body="BYOK is free for the first 1,000 reqs/mo, then $1/1000. Or top up credits and we cover the providers at a 2.5% markup."
					cta={
						providers.length === 0
							? { label: 'Add provider key', href: '/dashboard/providers' }
							: { label: 'Top up credits', href: '/dashboard/billing' }
					}
					secondaryCta={
						providers.length === 0
							? { label: 'Top up credits', href: '/dashboard/billing' }
							: { label: 'Manage provider keys', href: '/dashboard/providers' }
					}
				/>
				<Step
					n={3}
					done={hasMadeRequest}
					title="Wire up your client"
					body="Pick a client below to generate a copy-paste config. We never store your API key on this page — paste it once if you want it embedded in the snippet."
				/>
			</ol>

			{loading && <p className="mt-6 text-neutral-500">Loading…</p>}

			<section className="mt-10 max-w-3xl">
				<h2 className="text-lg font-semibold">Config generator</h2>
				<p className="mt-1 text-sm text-neutral-400">
					Pick a client and (optionally) paste an API key. Defaults to a placeholder you'll replace
					later.
				</p>

				<div className="mt-5 grid gap-4 sm:grid-cols-2">
					<div>
						<label htmlFor="client" className="block text-sm text-neutral-400 mb-1.5">
							Client
						</label>
						<select
							id="client"
							value={client}
							onChange={(e) => setClient(e.target.value as ClientId)}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
						>
							{CLIENT_OPTIONS.map((c) => (
								<option key={c.id} value={c.id}>
									{c.label}
								</option>
							))}
						</select>
						<p className="mt-1.5 text-xs text-neutral-500">
							{CLIENT_OPTIONS.find((c) => c.id === client)?.sub}
						</p>
					</div>
					<div>
						<label htmlFor="apiKey" className="block text-sm text-neutral-400 mb-1.5">
							API key (optional)
						</label>
						<input
							id="apiKey"
							type="password"
							autoComplete="off"
							value={keyValue}
							onChange={(e) => setKeyValue(e.target.value)}
							placeholder="edgrt_… (leave empty for placeholder)"
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-mono focus:border-purple-500 focus:outline-none"
						/>
						<p className="mt-1.5 text-xs text-neutral-500">
							Stays in your browser. Never sent anywhere.
						</p>
					</div>
				</div>

				<div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
					<div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/50 px-4 py-2">
						<span className="text-xs uppercase tracking-wider text-neutral-500">
							{client.startsWith('openai-') ? 'Source' : 'JSON'}
						</span>
						<button
							type="button"
							onClick={onCopy}
							className="rounded-md px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition"
						>
							{copied ? 'Copied' : 'Copy'}
						</button>
					</div>
					<pre className="overflow-x-auto p-4 text-sm leading-relaxed text-neutral-200">
						<code>{config}</code>
					</pre>
				</div>

				{client === 'claude-desktop' || client === 'cursor' || client === 'cline' ? (
					<p className="mt-3 text-xs text-neutral-500">
						Paste this into the client's MCP config file. The stdio shim is published as{' '}
						<code className="text-neutral-300">@edgerouteai/mcp-stdio</code> on npm and bridges to{' '}
						<code className="text-neutral-300">https://mcp.edgerouteai.com</code>.
					</p>
				) : (
					<p className="mt-3 text-xs text-neutral-500">
						The OpenAI SDK works unchanged — just swap the base URL and key.
					</p>
				)}

				<div className="mt-6 flex gap-3">
					<Link
						href="/dashboard"
						className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900 transition"
					>
						Back to overview
					</Link>
					<Link
						href="/dashboard/chat"
						className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
					>
						Try a request now
					</Link>
				</div>
			</section>
		</div>
	)
}

function Step({
	n,
	done,
	title,
	body,
	cta,
	secondaryCta,
}: {
	n: number
	done: boolean
	title: string
	body: string
	cta?: { label: string; href: string }
	secondaryCta?: { label: string; href: string }
}) {
	return (
		<li
			className={`rounded-lg border p-5 flex gap-4 ${
				done ? 'border-emerald-800/60 bg-emerald-950/10' : 'border-neutral-800 bg-neutral-900/30'
			}`}
		>
			<span
				className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
					done ? 'bg-emerald-700/40 text-emerald-200' : 'bg-neutral-800 text-neutral-300'
				}`}
			>
				{done ? '✓' : n}
			</span>
			<div className="flex-1 min-w-0">
				<p className="font-medium">{title}</p>
				<p className="mt-1 text-sm text-neutral-400">{body}</p>
				{(cta || secondaryCta) && (
					<div className="mt-3 flex gap-2 flex-wrap">
						{cta && (
							<Link
								href={cta.href}
								className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-900 transition"
							>
								{cta.label}
							</Link>
						)}
						{secondaryCta && (
							<Link
								href={secondaryCta.href}
								className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition"
							>
								{secondaryCta.label}
							</Link>
						)}
					</div>
				)}
			</div>
		</li>
	)
}

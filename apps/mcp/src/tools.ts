import { autoRoute } from '@edgerouteai/core'
import {
	createDb,
	providerKeys as providerKeysTable,
	requestLogs,
	userCredits,
} from '@edgerouteai/db'
import { type ChatMessage, MODELS, PRICING } from '@edgerouteai/shared'
import { desc, eq, gte } from 'drizzle-orm'
import type { McpEnv } from './env.js'

// ---------- Tool schemas ----------
// MCP tools are described via JSON-Schema. We keep these hand-written rather
// than pulling in a generator — the schemas are stable and hand-written
// schemas produce better LLM prompts.

export const TOOLS = [
	{
		name: 'chat',
		description:
			'Send messages to an LLM and get a completion. Use model="auto" to let EdgeRouteAI pick the best model for the task based on cost and quality. Deducts from your credit balance when a platform-managed key is used; zero-cost when you have your own provider key configured.',
		inputSchema: {
			type: 'object',
			properties: {
				model: {
					type: 'string',
					description:
						'Model identifier (e.g. "openai/gpt-5.4", "anthropic/claude-sonnet-4-6") or "auto" for automatic selection.',
				},
				messages: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							role: { type: 'string', enum: ['system', 'user', 'assistant'] },
							content: { type: 'string' },
						},
						required: ['role', 'content'],
					},
				},
				temperature: { type: 'number' },
				max_tokens: { type: 'integer' },
			},
			required: ['model', 'messages'],
		},
	},
	{
		name: 'list_models',
		description:
			'Return all models accessible to this API key. Includes models available via your own provider keys (BYOK, zero-markup) and models available via platform-managed keys (2.5% markup, credit-based).',
		inputSchema: { type: 'object', properties: {} },
	},
	{
		name: 'get_usage',
		description:
			"Return current credit balance, today's spend, and last-7-days spend. Useful for autonomous agents checking whether they can afford the next request.",
		inputSchema: { type: 'object', properties: {} },
	},
	{
		name: 'auto_select_model',
		description:
			'Preview which model would be auto-selected for a given task, with rationale. Does NOT make the call or charge anything — use this to inspect routing before committing to a chat.',
		inputSchema: {
			type: 'object',
			properties: {
				task: {
					type: 'string',
					description:
						'Natural-language description of the task (e.g. "write a Python function to parse CSV").',
				},
			},
			required: ['task'],
		},
	},
] as const

export type ToolName = (typeof TOOLS)[number]['name']

// ---------- Tool implementations ----------

export async function callChat(args: {
	env: McpEnv
	apiKey: string
	body: {
		model: string
		messages: ChatMessage[]
		temperature?: number
		max_tokens?: number
	}
}) {
	// Internally call the REST gateway. The gateway handles BYOK fallback to
	// platform keys, auto-routing, budgets, cost tracking, etc. — we don't
	// duplicate that logic here.
	const upstream = await fetch(`${args.env.API_BASE_URL}/v1/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${args.apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ ...args.body, stream: false }),
	})
	if (!upstream.ok) {
		const text = await upstream.text().catch(() => '')
		throw new Error(`Gateway error ${upstream.status}: ${text}`)
	}
	// Gateway streams SSE even when the client asks for non-stream — collect
	// the chunks and assemble a single final string for the MCP tool result.
	const raw = await upstream.text()
	const lines = raw.split('\n').filter((l) => l.startsWith('data: '))
	let fullContent = ''
	for (const line of lines) {
		const data = line.slice(6).trim()
		if (data === '[DONE]') continue
		try {
			const chunk = JSON.parse(data) as {
				choices?: Array<{ delta?: { content?: string } }>
			}
			const content = chunk.choices?.[0]?.delta?.content
			if (content) fullContent += content
		} catch {
			// Non-JSON SSE keepalives are fine to skip.
		}
	}
	return {
		content: [{ type: 'text', text: fullContent }],
		provider: upstream.headers.get('X-EdgeRoute-Provider'),
		model: upstream.headers.get('X-EdgeRoute-Model'),
		auto_reason: upstream.headers.get('X-EdgeRoute-Auto-Reason'),
	}
}

export async function callListModels(args: { env: McpEnv; userId: string }) {
	const db = createDb(args.env.DB)
	const userProviderKeys = await db
		.select({ provider: providerKeysTable.provider })
		.from(providerKeysTable)
		.where(eq(providerKeysTable.userId, args.userId))
	const byokProviders = new Set(userProviderKeys.map((p) => p.provider))

	const models = Object.entries(MODELS).map(([fullId, m]) => ({
		id: fullId,
		provider: m.provider,
		model: m.id,
		name: m.name,
		context_length: m.contextLength,
		access: byokProviders.has(m.provider) ? 'byok' : 'platform',
		pricing_usd_per_million: PRICING[fullId] ?? null,
	}))

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify({ models, byok_providers: [...byokProviders] }, null, 2),
			},
		],
		byok_providers: [...byokProviders],
		total_models: models.length,
	}
}

export async function callGetUsage(args: { env: McpEnv; userId: string }) {
	const db = createDb(args.env.DB)
	const [credits] = await db
		.select()
		.from(userCredits)
		.where(eq(userCredits.userId, args.userId))
		.limit(1)

	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

	const todayLogs = await db
		.select()
		.from(requestLogs)
		.where(eq(requestLogs.userId, args.userId))
		.orderBy(desc(requestLogs.createdAt))
		.limit(1000)

	const todaySpendUsd = todayLogs
		.filter((l) => l.createdAt >= oneDayAgo)
		.reduce((sum, l) => sum + (l.costUsd ?? 0), 0)
	const weekSpendUsd = todayLogs
		.filter((l) => l.createdAt >= sevenDaysAgo)
		.reduce((sum, l) => sum + (l.costUsd ?? 0), 0)

	const payload = {
		balance_cents: credits?.balanceCents ?? 0,
		lifetime_topped_up_cents: credits?.lifetimeToppedUpCents ?? 0,
		lifetime_spent_cents: credits?.lifetimeSpentCents ?? 0,
		today_spend_usd: Number(todaySpendUsd.toFixed(6)),
		last_7d_spend_usd: Number(weekSpendUsd.toFixed(6)),
	}
	return {
		content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
		...payload,
	}
}

export async function callAutoSelectModel(args: {
	env: McpEnv
	userId: string
	task: string
}) {
	const db = createDb(args.env.DB)
	const userProviderKeys = await db
		.select({ provider: providerKeysTable.provider })
		.from(providerKeysTable)
		.where(eq(providerKeysTable.userId, args.userId))
	const availableProviders = userProviderKeys.map((p) => p.provider)

	// Include all providers (platform-key availability assumed). If the user
	// has no BYOK, auto-router still picks a model — the gateway will fall
	// back to a platform key at request time.
	const effectiveProviders =
		availableProviders.length > 0
			? availableProviders
			: ['openai', 'anthropic', 'google', 'mistral', 'xai']

	const route = autoRoute({
		messages: [{ role: 'user', content: args.task }],
		availableProviders: effectiveProviders,
	})
	if (!route) {
		return {
			content: [{ type: 'text', text: 'No model could be selected.' }],
			selected: null,
		}
	}
	const payload = {
		provider: route.provider,
		model: route.modelId,
		full_name: `${route.provider}/${route.modelId}`,
		reason: route.reason,
		using_byok: availableProviders.includes(route.provider),
	}
	return {
		content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
		...payload,
	}
}

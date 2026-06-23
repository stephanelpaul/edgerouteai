// Smart-router v2: opt-in LLM-backed task classification.
//
// When SMART_ROUTER_LLM=1, the gateway calls a cheap model with a tightly-
// scoped prompt to classify each request as code/creative/general before
// passing the verdict to autoRoute. This is more accurate than the keyword
// scan in `@edgerouteai/core/router/classifier` for ambiguous prompts like
// "Refactor this paragraph" (creative, not code).
//
// Behavior:
// - Picks the cheapest classifier model from the user's BYOK providers.
//   Anthropic and Google are skipped because their non-OpenAI-compatible
//   response shapes would need extra parsing — the keyword fallback covers
//   those cases.
// - Caches verdicts in KV by SHA-256 of the user message (truncated to 2KB)
//   for 1 hour, so repeated prompts don't pay the classifier cost twice.
// - Fail-soft: any error (no BYOK, no compatible adapter, network, parse,
//   timeout) returns null so the caller falls back to keyword detection.
import { type TaskType, classifyTaskType, getAdapter, lastUserText } from '@edgerouteai/core'
import type { ProviderAdapter } from '@edgerouteai/core'
import { type Database, providerKeys } from '@edgerouteai/db'
import type { ChatMessage } from '@edgerouteai/shared'
import { eq } from 'drizzle-orm'
import { decrypt } from './crypto.js'
import type { Env } from './env.js'

// Provider preference (cheapest classifier first). Anthropic and Google omitted
// because their non-stream / non-OpenAI-compatible shapes would need a custom
// extractor; keyword detection is a fine fallback when those are the only
// available providers.
const CLASSIFIER_PROVIDER_ORDER = [
	'groq',
	'cloudflare',
	'together',
	'mistral',
	'cohere',
	'ollama',
	'openai',
	'azure',
	'xai',
] as const

const CLASSIFIER_MODEL_PER_PROVIDER: Record<string, string> = {
	groq: 'llama-3.1-8b-instant',
	cloudflare: 'llama-3.1-8b',
	together: 'llama-3.1-8b',
	mistral: 'mistral-small-latest',
	cohere: 'command-r',
	ollama: 'llama3.1',
	openai: 'gpt-5.4-mini',
	azure: 'gpt-4o-mini',
	xai: 'grok-4.20',
}

const CACHE_TTL_SECONDS = 3600
const CONTENT_HASH_INPUT_LIMIT = 2000
const STREAM_CONTENT_BUDGET_CHARS = 30
const CLASSIFIER_TIMEOUT_MS = 1500

export interface ClassifyForRequestOptions {
	env: Env
	db: Database
	userId: string
	messages: ChatMessage[]
}

/**
 * Returns a TaskType when the LLM classifier ran successfully, or null when
 * the caller should fall back to keyword detection (flag off, no BYOK, etc.).
 */
export async function classifyTaskTypeForRequest(
	opts: ClassifyForRequestOptions,
): Promise<TaskType | null> {
	if (opts.env.SMART_ROUTER_LLM !== '1') return null

	const text = lastUserText(opts.messages).trim()
	if (!text) return null

	const cacheKey = `class:${await hashText(text)}`
	const cached = await opts.env.CACHE.get(cacheKey)
	if (cached === 'code' || cached === 'creative' || cached === 'general') {
		return cached
	}

	const userKeys = await opts.db
		.select()
		.from(providerKeys)
		.where(eq(providerKeys.userId, opts.userId))

	const userProviderSet = new Set<string>(userKeys.map((k) => k.provider))
	const provider = CLASSIFIER_PROVIDER_ORDER.find((p) => userProviderSet.has(p))
	if (!provider) return null

	const modelId = CLASSIFIER_MODEL_PER_PROVIDER[provider]
	const adapter = getAdapter(provider)
	if (!modelId || !adapter) return null

	const keyRow = userKeys.find((k) => k.provider === provider)
	if (!keyRow) return null

	let apiKey: string
	try {
		apiKey = await decrypt(
			keyRow.encryptedKey as unknown as ArrayBuffer,
			keyRow.iv as unknown as Uint8Array,
			opts.env.ENCRYPTION_KEY,
		)
	} catch {
		return null
	}

	const verdict = await classifyTaskType({
		messages: opts.messages,
		timeoutMs: CLASSIFIER_TIMEOUT_MS,
		callModel: (prompt, signal) =>
			callClassifierProvider({ adapter, modelId, apiKey, prompt, signal }),
	})

	// Best-effort: store the verdict for 1h so repeat prompts skip the call.
	try {
		await opts.env.CACHE.put(cacheKey, verdict, { expirationTtl: CACHE_TTL_SECONDS })
	} catch {
		// Cache failure is non-fatal — verdict still returns.
	}

	return verdict
}

async function callClassifierProvider(args: {
	adapter: ProviderAdapter
	modelId: string
	apiKey: string
	prompt: string
	signal?: AbortSignal
}): Promise<string> {
	const providerReq = args.adapter.transformRequest(
		{
			model: args.modelId,
			messages: [{ role: 'user', content: args.prompt }],
			stream: true,
			max_tokens: 16,
			temperature: 0,
		},
		args.apiKey,
	)

	const response = await fetch(providerReq.url, {
		method: 'POST',
		headers: providerReq.headers,
		body: providerReq.body,
		signal: args.signal,
	})

	if (!response.ok || !response.body) {
		throw new Error(`Classifier provider ${args.adapter.id} returned ${response.status}`)
	}

	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ''
	let content = ''

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split('\n')
			buffer = lines.pop() ?? ''
			for (const line of lines) {
				if (!line.startsWith('data: ')) continue
				const data = line.substring(6).trim()
				if (!data || data === '[DONE]') continue
				const chunk = args.adapter.transformStreamChunk(data)
				const delta = chunk?.choices?.[0]?.delta?.content
				if (typeof delta === 'string') content += delta
				if (content.length >= STREAM_CONTENT_BUDGET_CHARS) {
					await reader.cancel().catch(() => {})
					return content
				}
			}
		}
	} finally {
		try {
			reader.releaseLock()
		} catch {
			// Lock may already be released by an earlier cancel; ignore.
		}
	}

	return content
}

async function hashText(text: string): Promise<string> {
	const truncated =
		text.length > CONTENT_HASH_INPUT_LIMIT ? text.slice(0, CONTENT_HASH_INPUT_LIMIT) : text
	const data = new TextEncoder().encode(truncated)
	const hash = await crypto.subtle.digest('SHA-256', data)
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, 32)
}

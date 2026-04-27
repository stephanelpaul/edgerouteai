import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ProviderRequest,
	TokenUsage,
} from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

// Cloudflare Workers AI exposes an OpenAI-compatible chat endpoint at
//   https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions
// The account id is not a secret on its own but is needed in the URL. To
// fit the existing "apiKey is a single string" adapter shape, we encode the
// credential as `{account_id}:{api_token}` — stored encrypted in the
// provider_keys row like any other key, split at the first colon here.

export const cloudflareAdapter: ProviderAdapter = {
	id: 'cloudflare',
	// Model ids follow Cloudflare's `@cf/vendor/name` convention. Kept as
	// native identifiers so the rest of the router doesn't need to care.
	models: [
		'@cf/meta/llama-3.3-70b-instruct-fp8-fast',
		'@cf/meta/llama-3.1-8b-instruct',
		'@cf/meta/llama-3.2-3b-instruct',
		'@cf/mistral/mistral-small-3.1-24b-instruct',
		'@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
		'@cf/google/gemma-3-12b-it',
	],

	transformRequest(req: ChatCompletionRequest, apiKey: string): ProviderRequest {
		const colonIdx = apiKey.indexOf(':')
		if (colonIdx === -1) {
			throw new Error(
				'Cloudflare Workers AI credentials must be formatted as "<account_id>:<api_token>".',
			)
		}
		const accountId = apiKey.slice(0, colonIdx)
		const token = apiKey.slice(colonIdx + 1)

		const body: Record<string, unknown> = {
			model: req.model,
			messages: req.messages,
			stream: req.stream ?? true,
		}
		if (req.stream !== false) {
			body.stream_options = { include_usage: true }
		}
		if (req.temperature !== undefined) body.temperature = req.temperature
		if (req.top_p !== undefined) body.top_p = req.top_p
		if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens
		if (req.stop !== undefined) body.stop = req.stop

		return {
			url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		}
	},

	transformStreamChunk(raw: string): ChatCompletionChunk | null {
		if (!raw || raw === '[DONE]') return null
		try {
			return JSON.parse(raw) as ChatCompletionChunk
		} catch {
			return null
		}
	},

	extractUsageFromChunks(chunks: ChatCompletionChunk[]): TokenUsage {
		for (let i = chunks.length - 1; i >= 0; i--) {
			if (chunks[i].usage) return chunks[i].usage as TokenUsage
		}
		return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
	},
}

import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ProviderRequest,
	TokenUsage,
} from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

// Cohere ships an OpenAI-compatible surface at
//   https://api.cohere.com/compatibility/v1/chat/completions
// Using this instead of Cohere's native /v2/chat avoids a whole bespoke
// request/response transform. Command A / R / R+ are the flagship models.

export const cohereAdapter: ProviderAdapter = {
	id: 'cohere',
	models: [
		'command-a-03-2025',
		'command-r-plus-08-2024',
		'command-r-08-2024',
		'command-r7b-12-2024',
	],

	transformRequest(req: ChatCompletionRequest, apiKey: string): ProviderRequest {
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
			url: 'https://api.cohere.com/compatibility/v1/chat/completions',
			headers: {
				Authorization: `Bearer ${apiKey}`,
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

import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ProviderRequest,
	TokenUsage,
} from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

// Groq is strict-OpenAI-compatible on /v1/chat/completions — the only
// differences that matter are the base URL, the model ids, and that Groq
// supports a much smaller set of OpenAI parameters (no penalties, etc.).

export const groqAdapter: ProviderAdapter = {
	id: 'groq',
	models: [
		'llama-3.3-70b-versatile',
		'llama-3.1-8b-instant',
		'deepseek-r1-distill-llama-70b',
		'qwen-2.5-coder-32b',
		'mixtral-8x7b-32768',
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
			url: 'https://api.groq.com/openai/v1/chat/completions',
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
		// Groq emits usage in the final chunk's `x_groq.usage` (non-standard) as
		// well as the OpenAI-standard top-level `usage` — prefer the latter.
		for (let i = chunks.length - 1; i >= 0; i--) {
			if (chunks[i].usage) return chunks[i].usage as TokenUsage
		}
		return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
	},
}

import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ProviderRequest,
	TokenUsage,
} from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

// Together.ai is strict-OpenAI-compatible on /v1/chat/completions. Model ids
// follow Together's naming: "org/model" (e.g. "meta-llama/Llama-3.3-70B-Instruct-Turbo").
// We use slash-free keys in the outer registry ("together/...") and pass the
// full org/model id through as the native model id.

export const togetherAdapter: ProviderAdapter = {
	id: 'together',
	models: [
		'meta-llama/Llama-3.3-70B-Instruct-Turbo',
		'meta-llama/Llama-3.1-8B-Instruct-Turbo',
		'Qwen/Qwen2.5-72B-Instruct-Turbo',
		'Qwen/Qwen2.5-Coder-32B-Instruct',
		'deepseek-ai/DeepSeek-V3',
		'deepseek-ai/DeepSeek-R1',
		'mistralai/Mixtral-8x22B-Instruct-v0.1',
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
			url: 'https://api.together.xyz/v1/chat/completions',
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

import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ProviderRequest,
	TokenUsage,
} from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

// Ollama runs locally or on a user-controlled host. The OpenAI-compatible
// surface lives at `{baseUrl}/v1/chat/completions` (typically
// http://localhost:11434). Because the base URL is per-user (not a known
// constant), we encode the "credential" as either:
//
//   just the base URL:           "http://localhost:11434"
//   base URL + optional token:   "http://localhost:11434|token-if-any"
//
// The pipe separator is used instead of colon because URLs contain colons.
// When no token is present we omit the Authorization header — Ollama by
// default doesn't require auth on its local socket.

export const ollamaAdapter: ProviderAdapter = {
	id: 'ollama',
	// Ollama's model catalog is whatever the user has `ollama pull`'d. We
	// accept any slash-allowed string past the adapter layer — these entries
	// are just the common defaults for auto-complete / dashboard hints.
	models: [
		'llama3.3',
		'llama3.2',
		'llama3.1',
		'qwen2.5',
		'qwen2.5-coder',
		'deepseek-r1',
		'mistral',
		'gemma3',
		'phi4',
	],

	transformRequest(req: ChatCompletionRequest, apiKey: string): ProviderRequest {
		const pipeIdx = apiKey.indexOf('|')
		const baseUrl = (pipeIdx === -1 ? apiKey : apiKey.slice(0, pipeIdx)).replace(/\/$/, '')
		const token = pipeIdx === -1 ? '' : apiKey.slice(pipeIdx + 1)

		if (!/^https?:\/\//.test(baseUrl)) {
			throw new Error(
				'Ollama credential must start with http:// or https:// (e.g. "http://localhost:11434").',
			)
		}

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

		const headers: Record<string, string> = { 'Content-Type': 'application/json' }
		if (token) headers.Authorization = `Bearer ${token}`

		return {
			url: `${baseUrl}/v1/chat/completions`,
			headers,
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

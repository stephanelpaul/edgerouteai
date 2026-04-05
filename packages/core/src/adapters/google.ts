import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ProviderRequest,
	TokenUsage,
} from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

interface GeminiResponse {
	candidates?: Array<{
		content?: { parts?: Array<{ text?: string }>; role?: string }
		finishReason?: string
	}>
	usageMetadata?: {
		promptTokenCount?: number
		candidatesTokenCount?: number
		totalTokenCount?: number
	}
}

export const googleAdapter: ProviderAdapter = {
	id: 'google',
	models: [
		'gemini-2.5-pro-preview-03-25',
		'gemini-2.5-flash-preview-04-17',
		'gemini-2.5-flash-lite',
	],

	transformRequest(req: ChatCompletionRequest, apiKey: string): ProviderRequest {
		const systemMessage = req.messages.find((m) => m.role === 'system')
		const nonSystemMessages = req.messages.filter((m) => m.role !== 'system')
		const contents = nonSystemMessages.map((m) => ({
			role: m.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
		}))
		const body: Record<string, unknown> = { contents }
		if (systemMessage) {
			body.system_instruction = {
				parts: [
					{
						text:
							typeof systemMessage.content === 'string'
								? systemMessage.content
								: JSON.stringify(systemMessage.content),
					},
				],
			}
		}
		if (req.temperature !== undefined || req.max_tokens !== undefined || req.top_p !== undefined) {
			const generationConfig: Record<string, unknown> = {}
			if (req.temperature !== undefined) generationConfig.temperature = req.temperature
			if (req.max_tokens !== undefined) generationConfig.maxOutputTokens = req.max_tokens
			if (req.top_p !== undefined) generationConfig.topP = req.top_p
			body.generationConfig = generationConfig
		}
		return {
			url: `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:streamGenerateContent?alt=sse&key=${apiKey}`,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}
	},

	transformStreamChunk(raw: string): ChatCompletionChunk | null {
		if (!raw) return null
		let data: GeminiResponse
		try {
			data = JSON.parse(raw)
		} catch {
			return null
		}
		const candidate = data.candidates?.[0]
		if (!candidate) return null
		const text = candidate.content?.parts?.[0]?.text ?? ''
		const finishReason = candidate.finishReason === 'STOP' ? ('stop' as const) : null
		return {
			id: `gemini-${Date.now()}`,
			object: 'chat.completion.chunk',
			created: Math.floor(Date.now() / 1000),
			model: '',
			choices: [{ index: 0, delta: { content: text }, finish_reason: finishReason }],
			usage: data.usageMetadata
				? {
						prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
						completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
						total_tokens: data.usageMetadata.totalTokenCount ?? 0,
					}
				: undefined,
		}
	},

	extractUsageFromChunks(chunks: ChatCompletionChunk[]): TokenUsage {
		for (let i = chunks.length - 1; i >= 0; i--) {
			const usage = chunks[i].usage
			if (usage && usage.total_tokens > 0) return usage
		}
		return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
	},
}

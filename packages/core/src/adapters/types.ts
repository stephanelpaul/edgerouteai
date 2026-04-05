import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ProviderRequest,
	TokenUsage,
} from '@edgerouteai/shared'

export interface ProviderAdapter {
	id: string
	models: string[]
	transformRequest(req: ChatCompletionRequest, apiKey: string): ProviderRequest
	transformStreamChunk(raw: string): ChatCompletionChunk | null
	extractUsageFromChunks(chunks: ChatCompletionChunk[]): TokenUsage
}

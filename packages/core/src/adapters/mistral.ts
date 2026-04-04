import type { ChatCompletionRequest, ChatCompletionChunk, ProviderRequest, TokenUsage } from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

export const mistralAdapter: ProviderAdapter = {
  id: 'mistral',
  models: ['mistral-large-latest', 'mistral-medium-latest'],

  transformRequest(req: ChatCompletionRequest, apiKey: string): ProviderRequest {
    const body: Record<string, unknown> = { model: req.model, messages: req.messages, stream: req.stream ?? true }
    if (req.temperature !== undefined) body.temperature = req.temperature
    if (req.top_p !== undefined) body.top_p = req.top_p
    if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  },

  transformStreamChunk(raw: string): ChatCompletionChunk | null {
    if (!raw || raw === '[DONE]') return null
    try { return JSON.parse(raw) as ChatCompletionChunk } catch { return null }
  },

  extractUsageFromChunks(chunks: ChatCompletionChunk[]): TokenUsage {
    for (let i = chunks.length - 1; i >= 0; i--) { if (chunks[i].usage) return chunks[i].usage! }
    return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  },
}

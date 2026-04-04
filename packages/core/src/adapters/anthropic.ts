import type { ChatCompletionRequest, ChatCompletionChunk, ProviderRequest, TokenUsage } from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

interface AnthropicEvent {
  type: string
  index?: number
  delta?: { type?: string; text?: string; stop_reason?: string }
  message?: { id?: string; model?: string; usage?: { input_tokens?: number } }
  usage?: { output_tokens?: number }
}

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],

  transformRequest(req: ChatCompletionRequest, apiKey: string): ProviderRequest {
    const systemMessage = req.messages.find((m) => m.role === 'system')
    const nonSystemMessages = req.messages.filter((m) => m.role !== 'system')

    const body: Record<string, unknown> = {
      model: req.model,
      messages: nonSystemMessages,
      max_tokens: req.max_tokens ?? 4096,
      stream: req.stream ?? true,
    }

    if (systemMessage) {
      body.system = typeof systemMessage.content === 'string' ? systemMessage.content : JSON.stringify(systemMessage.content)
    }
    if (req.temperature !== undefined) body.temperature = req.temperature
    if (req.top_p !== undefined) body.top_p = req.top_p
    if (req.stop !== undefined) body.stop_sequences = Array.isArray(req.stop) ? req.stop : [req.stop]

    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  },

  transformStreamChunk(raw: string): ChatCompletionChunk | null {
    if (!raw) return null
    let event: AnthropicEvent
    try { event = JSON.parse(raw) } catch { return null }

    const baseChunk = {
      id: '',
      object: 'chat.completion.chunk' as const,
      created: Math.floor(Date.now() / 1000),
      model: '',
    }

    switch (event.type) {
      case 'message_start':
        return {
          ...baseChunk,
          id: event.message?.id ?? '',
          model: event.message?.model ?? '',
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
          usage: event.message?.usage
            ? { prompt_tokens: event.message.usage.input_tokens ?? 0, completion_tokens: 0, total_tokens: event.message.usage.input_tokens ?? 0 }
            : undefined,
        }
      case 'content_block_delta':
        if (event.delta?.type === 'text_delta') {
          return {
            ...baseChunk,
            choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
          }
        }
        return null
      case 'message_delta':
        return {
          ...baseChunk,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' as const }],
          usage: event.usage
            ? { prompt_tokens: 0, completion_tokens: event.usage.output_tokens ?? 0, total_tokens: event.usage.output_tokens ?? 0 }
            : undefined,
        }
      default:
        return null
    }
  },

  extractUsageFromChunks(chunks: ChatCompletionChunk[]): TokenUsage {
    let promptTokens = 0
    let completionTokens = 0
    for (const chunk of chunks) {
      if (chunk.usage) {
        if (chunk.usage.prompt_tokens > 0) promptTokens = chunk.usage.prompt_tokens
        if (chunk.usage.completion_tokens > 0) completionTokens = chunk.usage.completion_tokens
      }
    }
    return { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens }
  },
}

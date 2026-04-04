import { describe, it, expect } from 'vitest'
import { xaiAdapter } from '@edgerouteai/core/adapters/xai'
import type { ChatCompletionRequest } from '@edgerouteai/shared'

describe('xAI Adapter', () => {
  const adapter = xaiAdapter

  it('has correct provider id', () => {
    expect(adapter.id).toBe('xai')
  })

  it('lists supported models', () => {
    expect(adapter.models).toContain('grok-4.20')
  })

  describe('transformRequest', () => {
    it('uses xAI API URL', () => {
      const req: ChatCompletionRequest = {
        model: 'grok-4.20',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = adapter.transformRequest(req, 'xai-api-key')
      expect(result.url).toBe('https://api.x.ai/v1/chat/completions')
    })

    it('uses Bearer token authorization', () => {
      const req: ChatCompletionRequest = {
        model: 'grok-4.20',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = adapter.transformRequest(req, 'xai-api-key')
      expect(result.headers['Authorization']).toBe('Bearer xai-api-key')
      expect(result.headers['Content-Type']).toBe('application/json')
    })

    it('includes stream_options with include_usage when streaming', () => {
      const req: ChatCompletionRequest = {
        model: 'grok-4.20',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }
      const result = adapter.transformRequest(req, 'xai-api-key')
      const body = JSON.parse(result.body)
      expect(body.stream_options).toEqual({ include_usage: true })
    })

    it('defaults stream to true and includes stream_options', () => {
      const req: ChatCompletionRequest = {
        model: 'grok-4.20',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = adapter.transformRequest(req, 'xai-api-key')
      const body = JSON.parse(result.body)
      expect(body.stream).toBe(true)
      expect(body.stream_options).toEqual({ include_usage: true })
    })

    it('omits stream_options when stream is false', () => {
      const req: ChatCompletionRequest = {
        model: 'grok-4.20',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }
      const result = adapter.transformRequest(req, 'xai-api-key')
      const body = JSON.parse(result.body)
      expect(body.stream_options).toBeUndefined()
    })

    it('passes through optional parameters', () => {
      const req: ChatCompletionRequest = {
        model: 'grok-4.20',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: 300,
      }
      const result = adapter.transformRequest(req, 'xai-api-key')
      const body = JSON.parse(result.body)
      expect(body.temperature).toBe(0.8)
      expect(body.top_p).toBe(0.95)
      expect(body.max_tokens).toBe(300)
    })
  })

  describe('transformStreamChunk', () => {
    it('parses a valid OpenAI-compatible SSE chunk', () => {
      const raw = JSON.stringify({
        id: 'grok-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'grok-4.20',
        choices: [{ index: 0, delta: { content: 'Grok here!' }, finish_reason: null }],
      })
      const chunk = adapter.transformStreamChunk(raw)
      expect(chunk).not.toBeNull()
      expect(chunk!.id).toBe('grok-123')
      expect(chunk!.choices[0].delta.content).toBe('Grok here!')
    })

    it('returns null for [DONE] signal', () => {
      expect(adapter.transformStreamChunk('[DONE]')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(adapter.transformStreamChunk('')).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(adapter.transformStreamChunk('not-json')).toBeNull()
    })
  })

  describe('extractUsageFromChunks', () => {
    it('extracts usage from last chunk with usage (from stream_options)', () => {
      const chunks = [
        {
          id: 'grok-123', object: 'chat.completion.chunk' as const, created: 1234567890, model: 'grok-4.20',
          choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
        },
        {
          id: 'grok-123', object: 'chat.completion.chunk' as const, created: 1234567890, model: 'grok-4.20',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' as const }],
          usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
        },
      ]
      const usage = adapter.extractUsageFromChunks(chunks)
      expect(usage).toEqual({ prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 })
    })

    it('returns zeros when no usage found', () => {
      const chunks = [
        {
          id: 'grok-123', object: 'chat.completion.chunk' as const, created: 1234567890, model: 'grok-4.20',
          choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
        },
      ]
      const usage = adapter.extractUsageFromChunks(chunks)
      expect(usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })
    })
  })
})

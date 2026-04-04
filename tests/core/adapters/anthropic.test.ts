import { describe, it, expect } from 'vitest'
import { anthropicAdapter } from '@edgerouteai/core/adapters/anthropic'
import type { ChatCompletionRequest } from '@edgerouteai/shared'

describe('Anthropic Adapter', () => {
  const adapter = anthropicAdapter

  it('has correct provider id', () => {
    expect(adapter.id).toBe('anthropic')
  })

  it('lists supported models', () => {
    expect(adapter.models).toContain('claude-opus-4-6')
    expect(adapter.models).toContain('claude-sonnet-4-6')
    expect(adapter.models).toContain('claude-haiku-4-5')
  })

  describe('transformRequest', () => {
    it('sets correct URL and headers', () => {
      const req: ChatCompletionRequest = {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = adapter.transformRequest(req, 'sk-ant-test-key')
      expect(result.url).toBe('https://api.anthropic.com/v1/messages')
      expect(result.headers['x-api-key']).toBe('sk-ant-test-key')
      expect(result.headers['anthropic-version']).toBe('2023-06-01')
      expect(result.headers['Content-Type']).toBe('application/json')
    })

    it('extracts system message to top-level system field', () => {
      const req: ChatCompletionRequest = {
        model: 'claude-sonnet-4-6',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
      }
      const result = adapter.transformRequest(req, 'sk-ant-test-key')
      const body = JSON.parse(result.body)
      expect(body.system).toBe('You are a helpful assistant.')
      expect(body.messages).toHaveLength(1)
      expect(body.messages[0].role).toBe('user')
    })

    it('defaults max_tokens to 4096 if not specified', () => {
      const req: ChatCompletionRequest = {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = adapter.transformRequest(req, 'sk-ant-test-key')
      const body = JSON.parse(result.body)
      expect(body.max_tokens).toBe(4096)
    })

    it('uses provided max_tokens when specified', () => {
      const req: ChatCompletionRequest = {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
      }
      const result = adapter.transformRequest(req, 'sk-ant-test-key')
      const body = JSON.parse(result.body)
      expect(body.max_tokens).toBe(1000)
    })

    it('converts stop string to stop_sequences array', () => {
      const req: ChatCompletionRequest = {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hello' }],
        stop: 'STOP',
      }
      const result = adapter.transformRequest(req, 'sk-ant-test-key')
      const body = JSON.parse(result.body)
      expect(body.stop_sequences).toEqual(['STOP'])
    })

    it('passes stop array as stop_sequences', () => {
      const req: ChatCompletionRequest = {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hello' }],
        stop: ['STOP1', 'STOP2'],
      }
      const result = adapter.transformRequest(req, 'sk-ant-test-key')
      const body = JSON.parse(result.body)
      expect(body.stop_sequences).toEqual(['STOP1', 'STOP2'])
    })

    it('passes through optional parameters', () => {
      const req: ChatCompletionRequest = {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        top_p: 0.9,
      }
      const result = adapter.transformRequest(req, 'sk-ant-test-key')
      const body = JSON.parse(result.body)
      expect(body.temperature).toBe(0.7)
      expect(body.top_p).toBe(0.9)
    })
  })

  describe('transformStreamChunk', () => {
    it('parses message_start event and captures input tokens', () => {
      const raw = JSON.stringify({
        type: 'message_start',
        message: { id: 'msg_123', model: 'claude-sonnet-4-6', usage: { input_tokens: 25 } },
      })
      const chunk = adapter.transformStreamChunk(raw)
      expect(chunk).not.toBeNull()
      expect(chunk!.id).toBe('msg_123')
      expect(chunk!.model).toBe('claude-sonnet-4-6')
      expect(chunk!.choices[0].delta.role).toBe('assistant')
      expect(chunk!.usage?.prompt_tokens).toBe(25)
    })

    it('parses content_block_delta event with text', () => {
      const raw = JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello there!' },
      })
      const chunk = adapter.transformStreamChunk(raw)
      expect(chunk).not.toBeNull()
      expect(chunk!.choices[0].delta.content).toBe('Hello there!')
      expect(chunk!.choices[0].finish_reason).toBeNull()
    })

    it('returns null for content_block_delta without text_delta type', () => {
      const raw = JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{}' },
      })
      const chunk = adapter.transformStreamChunk(raw)
      expect(chunk).toBeNull()
    })

    it('parses message_delta event with stop reason and output tokens', () => {
      const raw = JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 42 },
      })
      const chunk = adapter.transformStreamChunk(raw)
      expect(chunk).not.toBeNull()
      expect(chunk!.choices[0].finish_reason).toBe('stop')
      expect(chunk!.usage?.completion_tokens).toBe(42)
    })

    it('returns null for ping event', () => {
      const raw = JSON.stringify({ type: 'ping' })
      expect(adapter.transformStreamChunk(raw)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(adapter.transformStreamChunk('')).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(adapter.transformStreamChunk('not-json')).toBeNull()
    })
  })

  describe('extractUsageFromChunks', () => {
    it('combines prompt tokens from message_start and completion tokens from message_delta', () => {
      const chunks = [
        {
          id: 'msg_123', object: 'chat.completion.chunk' as const, created: 1234567890, model: 'claude-sonnet-4-6',
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
          usage: { prompt_tokens: 25, completion_tokens: 0, total_tokens: 25 },
        },
        {
          id: '', object: 'chat.completion.chunk' as const, created: 1234567890, model: '',
          choices: [{ index: 0, delta: { content: 'Hi!' }, finish_reason: null }],
        },
        {
          id: '', object: 'chat.completion.chunk' as const, created: 1234567890, model: '',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' as const }],
          usage: { prompt_tokens: 0, completion_tokens: 42, total_tokens: 42 },
        },
      ]
      const usage = adapter.extractUsageFromChunks(chunks)
      expect(usage.prompt_tokens).toBe(25)
      expect(usage.completion_tokens).toBe(42)
      expect(usage.total_tokens).toBe(67)
    })
  })
})

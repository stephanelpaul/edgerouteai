import { describe, it, expect } from 'vitest'
import { googleAdapter } from '@edgerouteai/core/adapters/google'
import type { ChatCompletionRequest } from '@edgerouteai/shared'

describe('Google Adapter', () => {
  const adapter = googleAdapter

  it('has correct provider id', () => {
    expect(adapter.id).toBe('google')
  })

  it('lists supported models', () => {
    expect(adapter.models).toContain('gemini-2.5-pro-preview-03-25')
    expect(adapter.models).toContain('gemini-2.5-flash-preview-04-17')
  })

  describe('transformRequest', () => {
    it('URL contains model name and streamGenerateContent', () => {
      const req: ChatCompletionRequest = {
        model: 'gemini-2.5-pro-preview-03-25',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = adapter.transformRequest(req, 'google-api-key')
      expect(result.url).toContain('gemini-2.5-pro-preview-03-25')
      expect(result.url).toContain('streamGenerateContent')
      expect(result.url).toContain('alt=sse')
      expect(result.url).toContain('key=google-api-key')
    })

    it('sets Content-Type header without Authorization', () => {
      const req: ChatCompletionRequest = {
        model: 'gemini-2.5-flash-preview-04-17',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = adapter.transformRequest(req, 'google-api-key')
      expect(result.headers['Content-Type']).toBe('application/json')
      expect(result.headers['Authorization']).toBeUndefined()
    })

    it('places system message in system_instruction', () => {
      const req: ChatCompletionRequest = {
        model: 'gemini-2.5-pro-preview-03-25',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
      }
      const result = adapter.transformRequest(req, 'google-api-key')
      const body = JSON.parse(result.body)
      expect(body.system_instruction).toBeDefined()
      expect(body.system_instruction.parts[0].text).toBe('You are a helpful assistant.')
      expect(body.contents).toHaveLength(1)
    })

    it('maps assistant role to model role in contents', () => {
      const req: ChatCompletionRequest = {
        model: 'gemini-2.5-pro-preview-03-25',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
      }
      const result = adapter.transformRequest(req, 'google-api-key')
      const body = JSON.parse(result.body)
      expect(body.contents[0].role).toBe('user')
      expect(body.contents[1].role).toBe('model')
      expect(body.contents[2].role).toBe('user')
    })

    it('maps messages to parts with text', () => {
      const req: ChatCompletionRequest = {
        model: 'gemini-2.5-pro-preview-03-25',
        messages: [{ role: 'user', content: 'Hello Gemini' }],
      }
      const result = adapter.transformRequest(req, 'google-api-key')
      const body = JSON.parse(result.body)
      expect(body.contents[0].parts[0].text).toBe('Hello Gemini')
    })

    it('includes generationConfig when optional params are provided', () => {
      const req: ChatCompletionRequest = {
        model: 'gemini-2.5-pro-preview-03-25',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
        max_tokens: 500,
        top_p: 0.8,
      }
      const result = adapter.transformRequest(req, 'google-api-key')
      const body = JSON.parse(result.body)
      expect(body.generationConfig.temperature).toBe(0.5)
      expect(body.generationConfig.maxOutputTokens).toBe(500)
      expect(body.generationConfig.topP).toBe(0.8)
    })

    it('omits generationConfig when no optional params', () => {
      const req: ChatCompletionRequest = {
        model: 'gemini-2.5-pro-preview-03-25',
        messages: [{ role: 'user', content: 'Hello' }],
      }
      const result = adapter.transformRequest(req, 'google-api-key')
      const body = JSON.parse(result.body)
      expect(body.generationConfig).toBeUndefined()
    })
  })

  describe('transformStreamChunk', () => {
    it('parses a Gemini streaming chunk', () => {
      const raw = JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Hello!' }], role: 'model' }, finishReason: 'OTHER' }],
      })
      const chunk = adapter.transformStreamChunk(raw)
      expect(chunk).not.toBeNull()
      expect(chunk!.choices[0].delta.content).toBe('Hello!')
      expect(chunk!.choices[0].finish_reason).toBeNull()
    })

    it('sets finish_reason to stop when finishReason is STOP', () => {
      const raw = JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Done.' }], role: 'model' }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      })
      const chunk = adapter.transformStreamChunk(raw)
      expect(chunk).not.toBeNull()
      expect(chunk!.choices[0].finish_reason).toBe('stop')
      expect(chunk!.usage?.prompt_tokens).toBe(10)
      expect(chunk!.usage?.completion_tokens).toBe(5)
      expect(chunk!.usage?.total_tokens).toBe(15)
    })

    it('returns null for empty string', () => {
      expect(adapter.transformStreamChunk('')).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(adapter.transformStreamChunk('not-json')).toBeNull()
    })

    it('returns null when no candidates', () => {
      const raw = JSON.stringify({ candidates: [] })
      expect(adapter.transformStreamChunk(raw)).toBeNull()
    })
  })

  describe('extractUsageFromChunks', () => {
    it('returns usage from last chunk with non-zero total_tokens', () => {
      const chunks = [
        {
          id: 'gemini-1', object: 'chat.completion.chunk' as const, created: 1234567890, model: '',
          choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
        },
        {
          id: 'gemini-2', object: 'chat.completion.chunk' as const, created: 1234567890, model: '',
          choices: [{ index: 0, delta: { content: ' world' }, finish_reason: 'stop' as const }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ]
      const usage = adapter.extractUsageFromChunks(chunks)
      expect(usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 })
    })

    it('returns zero usage when no chunks have usage', () => {
      const chunks = [
        {
          id: 'gemini-1', object: 'chat.completion.chunk' as const, created: 1234567890, model: '',
          choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
        },
      ]
      const usage = adapter.extractUsageFromChunks(chunks)
      expect(usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })
    })
  })
})

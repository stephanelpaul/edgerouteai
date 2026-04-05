import { openaiAdapter } from '@edgerouteai/core/adapters/openai'
import type { ChatCompletionRequest } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

describe('OpenAI Adapter', () => {
	const adapter = openaiAdapter

	it('has correct provider id', () => {
		expect(adapter.id).toBe('openai')
	})

	it('lists supported models', () => {
		expect(adapter.models).toContain('gpt-4o')
		expect(adapter.models).toContain('gpt-4.1')
		expect(adapter.models).toContain('o3')
		expect(adapter.models).toContain('o4-mini')
	})

	describe('transformRequest', () => {
		it('transforms a chat completion request', () => {
			const req: ChatCompletionRequest = {
				model: 'gpt-4o',
				messages: [{ role: 'user', content: 'Hello' }],
				stream: true,
			}
			const result = adapter.transformRequest(req, 'sk-test-key')
			expect(result.url).toBe('https://api.openai.com/v1/chat/completions')
			expect(result.headers.Authorization).toBe('Bearer sk-test-key')
			expect(result.headers['Content-Type']).toBe('application/json')
			const body = JSON.parse(result.body)
			expect(body.model).toBe('gpt-4o')
			expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }])
			expect(body.stream).toBe(true)
			expect(body.stream_options).toEqual({ include_usage: true })
		})

		it('passes through optional parameters', () => {
			const req: ChatCompletionRequest = {
				model: 'gpt-4o',
				messages: [{ role: 'user', content: 'Hello' }],
				temperature: 0.7,
				max_tokens: 100,
				stream: true,
			}
			const result = adapter.transformRequest(req, 'sk-test-key')
			const body = JSON.parse(result.body)
			expect(body.temperature).toBe(0.7)
			expect(body.max_tokens).toBe(100)
		})
	})

	describe('transformStreamChunk', () => {
		it('parses a valid SSE data line', () => {
			const raw =
				'{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}'
			const chunk = adapter.transformStreamChunk(raw)
			expect(chunk).not.toBeNull()
			expect(chunk?.id).toBe('chatcmpl-123')
			expect(chunk?.choices[0].delta.content).toBe('Hello')
		})

		it('returns null for [DONE] signal', () => {
			expect(adapter.transformStreamChunk('[DONE]')).toBeNull()
		})

		it('returns null for empty string', () => {
			expect(adapter.transformStreamChunk('')).toBeNull()
		})
	})

	describe('extractUsageFromChunks', () => {
		it('extracts usage from the last chunk', () => {
			const chunks = [
				{
					id: 'chatcmpl-123',
					object: 'chat.completion.chunk' as const,
					created: 1234567890,
					model: 'gpt-4o',
					choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
				},
				{
					id: 'chatcmpl-123',
					object: 'chat.completion.chunk' as const,
					created: 1234567890,
					model: 'gpt-4o',
					choices: [{ index: 0, delta: {}, finish_reason: 'stop' as const }],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				},
			]
			const usage = adapter.extractUsageFromChunks(chunks)
			expect(usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 })
		})
	})
})

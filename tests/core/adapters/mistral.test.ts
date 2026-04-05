import { mistralAdapter } from '@edgerouteai/core/adapters/mistral'
import type { ChatCompletionRequest } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

describe('Mistral Adapter', () => {
	const adapter = mistralAdapter

	it('has correct provider id', () => {
		expect(adapter.id).toBe('mistral')
	})

	it('lists supported models', () => {
		expect(adapter.models).toContain('mistral-large-latest')
		expect(adapter.models).toContain('mistral-medium-latest')
	})

	describe('transformRequest', () => {
		it('uses Mistral API URL', () => {
			const req: ChatCompletionRequest = {
				model: 'mistral-large-latest',
				messages: [{ role: 'user', content: 'Hello' }],
			}
			const result = adapter.transformRequest(req, 'mistral-api-key')
			expect(result.url).toBe('https://api.mistral.ai/v1/chat/completions')
		})

		it('uses Bearer token authorization', () => {
			const req: ChatCompletionRequest = {
				model: 'mistral-large-latest',
				messages: [{ role: 'user', content: 'Hello' }],
			}
			const result = adapter.transformRequest(req, 'mistral-api-key')
			expect(result.headers.Authorization).toBe('Bearer mistral-api-key')
			expect(result.headers['Content-Type']).toBe('application/json')
		})

		it('defaults stream to true', () => {
			const req: ChatCompletionRequest = {
				model: 'mistral-large-latest',
				messages: [{ role: 'user', content: 'Hello' }],
			}
			const result = adapter.transformRequest(req, 'mistral-api-key')
			const body = JSON.parse(result.body)
			expect(body.stream).toBe(true)
		})

		it('passes messages through as-is (OpenAI-compatible)', () => {
			const req: ChatCompletionRequest = {
				model: 'mistral-large-latest',
				messages: [
					{ role: 'system', content: 'Be helpful.' },
					{ role: 'user', content: 'Hello' },
				],
			}
			const result = adapter.transformRequest(req, 'mistral-api-key')
			const body = JSON.parse(result.body)
			expect(body.messages).toHaveLength(2)
			expect(body.messages[0].role).toBe('system')
		})

		it('passes through optional parameters', () => {
			const req: ChatCompletionRequest = {
				model: 'mistral-large-latest',
				messages: [{ role: 'user', content: 'Hello' }],
				temperature: 0.7,
				top_p: 0.9,
				max_tokens: 200,
			}
			const result = adapter.transformRequest(req, 'mistral-api-key')
			const body = JSON.parse(result.body)
			expect(body.temperature).toBe(0.7)
			expect(body.top_p).toBe(0.9)
			expect(body.max_tokens).toBe(200)
		})
	})

	describe('transformStreamChunk', () => {
		it('parses a valid OpenAI-compatible SSE chunk', () => {
			const raw = JSON.stringify({
				id: 'cmpl-123',
				object: 'chat.completion.chunk',
				created: 1234567890,
				model: 'mistral-large-latest',
				choices: [{ index: 0, delta: { content: 'Hello!' }, finish_reason: null }],
			})
			const chunk = adapter.transformStreamChunk(raw)
			expect(chunk).not.toBeNull()
			expect(chunk?.id).toBe('cmpl-123')
			expect(chunk?.choices[0].delta.content).toBe('Hello!')
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
		it('extracts usage from the last chunk with usage', () => {
			const chunks = [
				{
					id: 'cmpl-123',
					object: 'chat.completion.chunk' as const,
					created: 1234567890,
					model: 'mistral-large-latest',
					choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
				},
				{
					id: 'cmpl-123',
					object: 'chat.completion.chunk' as const,
					created: 1234567890,
					model: 'mistral-large-latest',
					choices: [{ index: 0, delta: {}, finish_reason: 'stop' as const }],
					usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
				},
			]
			const usage = adapter.extractUsageFromChunks(chunks)
			expect(usage).toEqual({ prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 })
		})

		it('returns zeros when no usage found', () => {
			const chunks = [
				{
					id: 'cmpl-123',
					object: 'chat.completion.chunk' as const,
					created: 1234567890,
					model: 'mistral-large-latest',
					choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
				},
			]
			const usage = adapter.extractUsageFromChunks(chunks)
			expect(usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })
		})
	})
})

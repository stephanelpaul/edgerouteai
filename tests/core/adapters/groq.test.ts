import { groqAdapter } from '@edgerouteai/core/adapters/groq'
import type { ChatCompletionChunk, ChatCompletionRequest } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

describe('Groq Adapter', () => {
	it('has correct provider id', () => {
		expect(groqAdapter.id).toBe('groq')
	})

	it('includes flagship Llama + DeepSeek + Qwen models', () => {
		expect(groqAdapter.models).toContain('llama-3.3-70b-versatile')
		expect(groqAdapter.models).toContain('llama-3.1-8b-instant')
		expect(groqAdapter.models).toContain('deepseek-r1-distill-llama-70b')
		expect(groqAdapter.models).toContain('qwen-2.5-coder-32b')
	})

	it('transforms a request to Groq OpenAI-compat endpoint', () => {
		const req: ChatCompletionRequest = {
			model: 'llama-3.3-70b-versatile',
			messages: [{ role: 'user', content: 'Hello' }],
			stream: true,
		}
		const result = groqAdapter.transformRequest(req, 'gsk_test')
		expect(result.url).toBe('https://api.groq.com/openai/v1/chat/completions')
		expect(result.headers.Authorization).toBe('Bearer gsk_test')
		const body = JSON.parse(result.body)
		expect(body.model).toBe('llama-3.3-70b-versatile')
		expect(body.stream).toBe(true)
		expect(body.stream_options).toEqual({ include_usage: true })
	})

	it('omits stream_options when streaming disabled', () => {
		const result = groqAdapter.transformRequest(
			{ model: 'llama-3.1-8b-instant', messages: [], stream: false },
			'gsk_test',
		)
		const body = JSON.parse(result.body)
		expect(body.stream).toBe(false)
		expect(body.stream_options).toBeUndefined()
	})

	it('parses stream chunks as JSON and handles [DONE]', () => {
		expect(groqAdapter.transformStreamChunk('[DONE]')).toBeNull()
		expect(groqAdapter.transformStreamChunk('')).toBeNull()
		expect(groqAdapter.transformStreamChunk('not json')).toBeNull()
		const parsed = groqAdapter.transformStreamChunk(
			JSON.stringify({ id: '1', object: 'chat.completion.chunk', choices: [] }),
		)
		expect(parsed?.id).toBe('1')
	})

	it('extracts usage from the last chunk that has it', () => {
		const chunks: ChatCompletionChunk[] = [
			{ id: '1', object: 'chat.completion.chunk', choices: [] },
			{
				id: '2',
				object: 'chat.completion.chunk',
				choices: [],
				usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
			},
			{ id: '3', object: 'chat.completion.chunk', choices: [] },
		] as ChatCompletionChunk[]
		expect(groqAdapter.extractUsageFromChunks(chunks).total_tokens).toBe(30)
	})

	it('returns zeros when no chunk has usage', () => {
		const chunks: ChatCompletionChunk[] = [
			{ id: '1', object: 'chat.completion.chunk', choices: [] },
		] as ChatCompletionChunk[]
		const usage = groqAdapter.extractUsageFromChunks(chunks)
		expect(usage.prompt_tokens).toBe(0)
		expect(usage.completion_tokens).toBe(0)
	})
})

import { togetherAdapter } from '@edgerouteai/core/adapters/together'
import type { ChatCompletionChunk, ChatCompletionRequest } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

describe('Together Adapter', () => {
	it('has correct provider id', () => {
		expect(togetherAdapter.id).toBe('together')
	})

	it('lists Llama + DeepSeek + Qwen Turbo models', () => {
		expect(togetherAdapter.models).toContain('meta-llama/Llama-3.3-70B-Instruct-Turbo')
		expect(togetherAdapter.models).toContain('deepseek-ai/DeepSeek-V3')
		expect(togetherAdapter.models).toContain('deepseek-ai/DeepSeek-R1')
		expect(togetherAdapter.models).toContain('Qwen/Qwen2.5-Coder-32B-Instruct')
	})

	it('transforms a request to Together endpoint', () => {
		const req: ChatCompletionRequest = {
			model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
			messages: [{ role: 'user', content: 'Hello' }],
			stream: true,
		}
		const result = togetherAdapter.transformRequest(req, 'together_key')
		expect(result.url).toBe('https://api.together.xyz/v1/chat/completions')
		expect(result.headers.Authorization).toBe('Bearer together_key')
		const body = JSON.parse(result.body)
		expect(body.model).toBe('meta-llama/Llama-3.3-70B-Instruct-Turbo')
	})

	it('parses stream chunks', () => {
		expect(togetherAdapter.transformStreamChunk('[DONE]')).toBeNull()
		const parsed = togetherAdapter.transformStreamChunk(
			JSON.stringify({ id: '1', object: 'chat.completion.chunk', choices: [] }),
		)
		expect(parsed?.id).toBe('1')
	})

	it('extracts usage from the last chunk that has it', () => {
		const chunks: ChatCompletionChunk[] = [
			{
				id: '1',
				object: 'chat.completion.chunk',
				choices: [],
				usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
			},
		] as ChatCompletionChunk[]
		expect(togetherAdapter.extractUsageFromChunks(chunks).total_tokens).toBe(15)
	})
})

import { cloudflareAdapter } from '@edgerouteai/core/adapters/cloudflare'
import type { ChatCompletionChunk, ChatCompletionRequest } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

describe('Cloudflare Workers AI Adapter', () => {
	it('has correct provider id', () => {
		expect(cloudflareAdapter.id).toBe('cloudflare')
	})

	it('lists @cf/... model ids', () => {
		expect(cloudflareAdapter.models).toContain('@cf/meta/llama-3.1-8b-instruct')
		expect(cloudflareAdapter.models).toContain('@cf/mistral/mistral-small-3.1-24b-instruct')
		expect(cloudflareAdapter.models).toContain('@cf/google/gemma-3-12b-it')
	})

	it('splits credential at the first colon into account_id and token', () => {
		const req: ChatCompletionRequest = {
			model: '@cf/meta/llama-3.1-8b-instruct',
			messages: [{ role: 'user', content: 'Hi' }],
		}
		const result = cloudflareAdapter.transformRequest(req, 'acct_123:secret-token-value')
		expect(result.url).toBe(
			'https://api.cloudflare.com/client/v4/accounts/acct_123/ai/v1/chat/completions',
		)
		expect(result.headers.Authorization).toBe('Bearer secret-token-value')
	})

	it('preserves colons inside the token portion', () => {
		// Cloudflare API tokens can contain colons; split only at the FIRST one.
		const result = cloudflareAdapter.transformRequest(
			{ model: '@cf/meta/llama-3.1-8b-instruct', messages: [] },
			'acct_abc:tok:with:colons',
		)
		expect(result.headers.Authorization).toBe('Bearer tok:with:colons')
	})

	it('throws with a clear error when credential is missing the colon', () => {
		expect(() =>
			cloudflareAdapter.transformRequest(
				{ model: '@cf/meta/llama-3.1-8b-instruct', messages: [] },
				'just-a-token-no-account',
			),
		).toThrow(/account_id/)
	})

	it('parses stream chunks like OpenAI', () => {
		const parsed = cloudflareAdapter.transformStreamChunk(
			JSON.stringify({ id: '1', object: 'chat.completion.chunk', choices: [] }),
		)
		expect(parsed?.id).toBe('1')
	})

	it('extracts usage from chunks', () => {
		const chunks: ChatCompletionChunk[] = [
			{
				id: '1',
				object: 'chat.completion.chunk',
				choices: [],
				usage: { prompt_tokens: 3, completion_tokens: 7, total_tokens: 10 },
			},
		] as ChatCompletionChunk[]
		expect(cloudflareAdapter.extractUsageFromChunks(chunks).total_tokens).toBe(10)
	})
})

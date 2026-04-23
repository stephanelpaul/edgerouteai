import { cohereAdapter } from '@edgerouteai/core/adapters/cohere'
import type { ChatCompletionRequest } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

describe('Cohere Adapter', () => {
	it('has correct provider id', () => {
		expect(cohereAdapter.id).toBe('cohere')
	})

	it('lists Command-family models', () => {
		expect(cohereAdapter.models).toContain('command-a-03-2025')
		expect(cohereAdapter.models).toContain('command-r-plus-08-2024')
	})

	it('routes to the OpenAI-compat compatibility endpoint', () => {
		const req: ChatCompletionRequest = {
			model: 'command-a-03-2025',
			messages: [{ role: 'user', content: 'hi' }],
		}
		const result = cohereAdapter.transformRequest(req, 'cohere_key')
		expect(result.url).toBe('https://api.cohere.com/compatibility/v1/chat/completions')
		expect(result.headers.Authorization).toBe('Bearer cohere_key')
	})
})

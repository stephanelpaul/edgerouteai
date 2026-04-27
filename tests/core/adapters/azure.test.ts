import { azureAdapter } from '@edgerouteai/core/adapters/azure'
import type { ChatCompletionRequest } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

describe('Azure OpenAI Adapter', () => {
	it('has correct provider id', () => {
		expect(azureAdapter.id).toBe('azure')
	})

	it('builds Azure URL with explicit api-version', () => {
		const req: ChatCompletionRequest = {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: 'hi' }],
		}
		const result = azureAdapter.transformRequest(req, 'my-resource:my-deployment:2024-10-21:abc123')
		expect(result.url).toBe(
			'https://my-resource.openai.azure.com/openai/deployments/my-deployment/chat/completions?api-version=2024-10-21',
		)
		expect(result.headers['api-key']).toBe('abc123')
		expect(result.headers.Authorization).toBeUndefined()
	})

	it('defaults api-version when given 3-part credential', () => {
		const result = azureAdapter.transformRequest(
			{ model: 'gpt-4o', messages: [] },
			'my-resource:my-deployment:key123',
		)
		expect(result.url).toContain('api-version=2024-10-21')
		expect(result.headers['api-key']).toBe('key123')
	})

	it('omits the model field from the body (Azure uses deployment in URL)', () => {
		const result = azureAdapter.transformRequest(
			{ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
			'r:d:k',
		)
		const body = JSON.parse(result.body)
		expect(body.model).toBeUndefined()
		expect(body.messages).toHaveLength(1)
	})

	it('URL-encodes deployment names with special chars', () => {
		const result = azureAdapter.transformRequest(
			{ model: 'gpt-4o', messages: [] },
			'r:my deploy/v2:k',
		)
		expect(result.url).toContain('my%20deploy%2Fv2')
	})

	it('throws with a clear error when credential is malformed', () => {
		expect(() =>
			azureAdapter.transformRequest({ model: 'gpt-4o', messages: [] }, 'just-a-key'),
		).toThrow(/resource.*deployment.*api-key/)
	})
})

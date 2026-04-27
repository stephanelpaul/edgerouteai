import { ollamaAdapter } from '@edgerouteai/core/adapters/ollama'
import type { ChatCompletionRequest } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

describe('Ollama Adapter', () => {
	it('has correct provider id', () => {
		expect(ollamaAdapter.id).toBe('ollama')
	})

	it('accepts a base URL as the full credential (no token)', () => {
		const req: ChatCompletionRequest = { model: 'llama3.3', messages: [] }
		const result = ollamaAdapter.transformRequest(req, 'http://localhost:11434')
		expect(result.url).toBe('http://localhost:11434/v1/chat/completions')
		expect(result.headers.Authorization).toBeUndefined()
	})

	it('accepts base URL with trailing slash (normalizes)', () => {
		const result = ollamaAdapter.transformRequest(
			{ model: 'llama3.3', messages: [] },
			'http://localhost:11434/',
		)
		expect(result.url).toBe('http://localhost:11434/v1/chat/completions')
	})

	it('accepts base URL + pipe-separated token', () => {
		const result = ollamaAdapter.transformRequest(
			{ model: 'llama3.3', messages: [] },
			'https://ollama.example.com|secret-token',
		)
		expect(result.url).toBe('https://ollama.example.com/v1/chat/completions')
		expect(result.headers.Authorization).toBe('Bearer secret-token')
	})

	it('rejects credentials that are not URLs', () => {
		expect(() =>
			ollamaAdapter.transformRequest({ model: 'llama3.3', messages: [] }, 'not-a-url'),
		).toThrow(/http/)
	})
})

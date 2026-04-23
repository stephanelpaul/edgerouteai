import { getAdapter, getAllAdapters } from '@edgerouteai/core/adapters/registry'
import { describe, expect, it } from 'vitest'

describe('Adapter Registry', () => {
	it('returns adapter by provider id', () => {
		expect(getAdapter('openai')?.id).toBe('openai')
		expect(getAdapter('anthropic')?.id).toBe('anthropic')
		expect(getAdapter('google')?.id).toBe('google')
		expect(getAdapter('mistral')?.id).toBe('mistral')
		expect(getAdapter('xai')?.id).toBe('xai')
		expect(getAdapter('groq')?.id).toBe('groq')
		expect(getAdapter('together')?.id).toBe('together')
		expect(getAdapter('cloudflare')?.id).toBe('cloudflare')
		expect(getAdapter('cohere')?.id).toBe('cohere')
		expect(getAdapter('ollama')?.id).toBe('ollama')
		expect(getAdapter('azure')?.id).toBe('azure')
	})

	it('returns undefined for unknown provider', () => {
		expect(getAdapter('unknown')).toBeUndefined()
	})

	it('returns all 11 adapters', () => {
		const adapters = getAllAdapters()
		expect(adapters).toHaveLength(11)
		const ids = adapters.map((a) => a.id).sort()
		expect(ids).toEqual([
			'anthropic',
			'azure',
			'cloudflare',
			'cohere',
			'google',
			'groq',
			'mistral',
			'ollama',
			'openai',
			'together',
			'xai',
		])
	})
})

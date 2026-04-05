import { getAdapter, getAllAdapters } from '@edgerouteai/core/adapters/registry'
import { describe, expect, it } from 'vitest'

describe('Adapter Registry', () => {
	it('returns adapter by provider id', () => {
		expect(getAdapter('openai')?.id).toBe('openai')
		expect(getAdapter('anthropic')?.id).toBe('anthropic')
		expect(getAdapter('google')?.id).toBe('google')
		expect(getAdapter('mistral')?.id).toBe('mistral')
		expect(getAdapter('xai')?.id).toBe('xai')
	})

	it('returns undefined for unknown provider', () => {
		expect(getAdapter('unknown')).toBeUndefined()
	})

	it('returns all 5 adapters', () => {
		const adapters = getAllAdapters()
		expect(adapters).toHaveLength(5)
		const ids = adapters.map((a) => a.id).sort()
		expect(ids).toEqual(['anthropic', 'google', 'mistral', 'openai', 'xai'])
	})
})

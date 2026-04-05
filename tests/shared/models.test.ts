import { MODELS, getProviderForModel, resolveModel } from '@edgerouteai/shared/models'
import { describe, expect, it } from 'vitest'

describe('Models', () => {
	it('has models for all 5 providers', () => {
		const providers = new Set(Object.values(MODELS).map((m) => m.provider))
		expect(providers).toContain('openai')
		expect(providers).toContain('anthropic')
		expect(providers).toContain('google')
		expect(providers).toContain('mistral')
		expect(providers).toContain('xai')
	})

	it('resolves model by full key', () => {
		const model = resolveModel('openai/gpt-5')
		expect(model).toBeDefined()
		expect(model?.provider).toBe('openai')
		expect(model?.id).toBe('gpt-5')
	})

	it('resolves model by bare id', () => {
		const model = resolveModel('gpt-4o')
		expect(model).toBeDefined()
		expect(model?.provider).toBe('openai')
	})

	it('returns undefined for unknown model', () => {
		expect(resolveModel('nonexistent')).toBeUndefined()
	})

	it('getProviderForModel returns correct provider', () => {
		expect(getProviderForModel('openai/gpt-5')).toBe('openai')
		expect(getProviderForModel('anthropic/claude-sonnet-4-6')).toBe('anthropic')
	})

	it('getProviderForModel returns undefined for unknown', () => {
		expect(getProviderForModel('unknown/model')).toBeUndefined()
	})
})

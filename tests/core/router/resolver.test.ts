import { resolveRoute } from '@edgerouteai/core/router/resolver'
import { describe, expect, it } from 'vitest'

describe('Route Resolver', () => {
	it('resolves "openai/gpt-4o" to openai adapter with model gpt-4o', () => {
		const route = resolveRoute('openai/gpt-4o')
		expect(route).not.toBeNull()
		expect(route?.provider).toBe('openai')
		expect(route?.modelId).toBe('gpt-4o')
		expect(route?.adapter.id).toBe('openai')
	})

	it('resolves "anthropic/claude-sonnet-4-6" to anthropic adapter', () => {
		const route = resolveRoute('anthropic/claude-sonnet-4-6')
		expect(route).not.toBeNull()
		expect(route?.provider).toBe('anthropic')
		expect(route?.modelId).toBe('claude-sonnet-4-6')
	})

	it('resolves bare model ID "gpt-4o" by searching adapters', () => {
		const route = resolveRoute('gpt-4o')
		expect(route).not.toBeNull()
		expect(route?.provider).toBe('openai')
	})

	it('returns null for unknown model', () => {
		expect(resolveRoute('unknown/nonexistent-model')).toBeNull()
	})
})

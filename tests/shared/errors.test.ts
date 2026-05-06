import {
	AuthenticationError,
	EdgeRouteError,
	InsufficientCreditsError,
	ModelNotFoundError,
	ProviderError,
	ProviderKeyMissingError,
	RateLimitError,
} from '@edgerouteai/shared/errors'
import { describe, expect, it } from 'vitest'

describe('Errors', () => {
	it('EdgeRouteError has correct properties', () => {
		const err = new EdgeRouteError('test', 'test_code', 400)
		expect(err.message).toBe('test')
		expect(err.code).toBe('test_code')
		expect(err.status).toBe(400)
		expect(err.toJSON()).toEqual({
			error: { message: 'test', code: 'test_code', type: 'edgeroute_error' },
		})
	})

	it('AuthenticationError defaults', () => {
		const err = new AuthenticationError()
		expect(err.status).toBe(401)
		expect(err.code).toBe('invalid_api_key')
	})

	it('RateLimitError defaults', () => {
		const err = new RateLimitError()
		expect(err.status).toBe(429)
	})

	it('ProviderError includes provider', () => {
		const err = new ProviderError('openai', 'Rate limited', 429)
		expect(err.provider).toBe('openai')
		expect(err.status).toBe(429)
	})

	it('ModelNotFoundError includes model name', () => {
		const err = new ModelNotFoundError('bad-model')
		expect(err.message).toContain('bad-model')
		expect(err.status).toBe(404)
	})

	it('ProviderKeyMissingError includes provider', () => {
		const err = new ProviderKeyMissingError('anthropic')
		expect(err.message).toContain('anthropic')
		expect(err.status).toBe(400)
	})

	it('InsufficientCreditsError returns 402 with top_up_url', () => {
		const err = new InsufficientCreditsError()
		expect(err.status).toBe(402)
		expect(err.code).toBe('insufficient_credits')
		const body = err.toJSON() as { error: { top_up_url?: string } }
		expect(body.error.top_up_url).toContain('/billing')
	})
})

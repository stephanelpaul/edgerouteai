import { describe, expect, it } from 'vitest'
import { checkRateLimit } from '../../../apps/api/src/middleware/rate-limit'

describe('Rate Limiter', () => {
	it('allows request when under limit', async () => {
		const mockKV = {
			get: async () => JSON.stringify({ tokens: 50, lastRefill: Date.now() }),
			put: async () => {},
		}
		const result = await checkRateLimit(mockKV as any, 'key-123', 60)
		expect(result.allowed).toBe(true)
		expect(result.remaining).toBeGreaterThan(0)
	})
	it('blocks request when at limit', async () => {
		const mockKV = {
			get: async () => JSON.stringify({ tokens: 0, lastRefill: Date.now() }),
			put: async () => {},
		}
		const result = await checkRateLimit(mockKV as any, 'key-123', 60)
		expect(result.allowed).toBe(false)
	})
	it('refills tokens after time passes', async () => {
		const mockKV = {
			get: async () => JSON.stringify({ tokens: 0, lastRefill: Date.now() - 60_000 }),
			put: async () => {},
		}
		const result = await checkRateLimit(mockKV as any, 'key-123', 60)
		expect(result.allowed).toBe(true)
	})
	it('initializes new keys with full bucket', async () => {
		const mockKV = {
			get: async () => null,
			put: async () => {},
		}
		const result = await checkRateLimit(mockKV as any, 'new-key', 60)
		expect(result.allowed).toBe(true)
		expect(result.remaining).toBe(59)
	})
})

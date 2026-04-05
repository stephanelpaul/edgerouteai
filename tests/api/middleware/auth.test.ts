import { describe, expect, it } from 'vitest'
import { hashApiKey } from '../../../apps/api/src/middleware/auth'

describe('Auth Middleware', () => {
	describe('hashApiKey', () => {
		it('produces a consistent SHA-256 hash', async () => {
			const hash1 = await hashApiKey('sk-er-test123')
			const hash2 = await hashApiKey('sk-er-test123')
			expect(hash1).toBe(hash2)
			expect(hash1).toMatch(/^[a-f0-9]{64}$/)
		})
		it('produces different hashes for different keys', async () => {
			const hash1 = await hashApiKey('sk-er-key1')
			const hash2 = await hashApiKey('sk-er-key2')
			expect(hash1).not.toBe(hash2)
		})
	})
})

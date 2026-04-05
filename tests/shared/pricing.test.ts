import { MODELS } from '@edgerouteai/shared/models'
import { PRICING, calculateCost } from '@edgerouteai/shared/pricing'
import { describe, expect, it } from 'vitest'

describe('Pricing', () => {
	it('has pricing for every model', () => {
		for (const key of Object.keys(MODELS)) {
			expect(PRICING[key], `Missing pricing for ${key}`).toBeDefined()
		}
	})

	it('all prices are positive numbers', () => {
		for (const [key, price] of Object.entries(PRICING)) {
			expect(price.inputPerMillion, `${key} input`).toBeGreaterThan(0)
			expect(price.outputPerMillion, `${key} output`).toBeGreaterThan(0)
		}
	})

	it('calculates cost correctly', () => {
		const cost = calculateCost('openai/gpt-5', 1000000, 1000000)
		expect(cost).toBe(1.25 + 10) // input + output per million
	})

	it('returns 0 for unknown model', () => {
		expect(calculateCost('unknown/model', 1000, 1000)).toBe(0)
	})

	it('handles zero tokens', () => {
		expect(calculateCost('openai/gpt-5', 0, 0)).toBe(0)
	})
})

import { describe, expect, it } from 'vitest'
import {
	BYOK_FEE_BATCH_SIZE,
	BYOK_FEE_CENTS_PER_BATCH,
	FREE_BYOK_REQUESTS_PER_MONTH,
	feeCentsForNextByokRequest,
	isPastFreeTier,
	startOfMonthMs,
} from '../../../apps/api/src/lib/byok-fee'

describe('byok-fee.startOfMonthMs', () => {
	it('returns the UTC start of the month containing now', () => {
		// 2026-04-26T13:45:00Z → 2026-04-01T00:00:00Z
		const t = Date.UTC(2026, 3, 26, 13, 45, 0)
		const expected = Date.UTC(2026, 3, 1, 0, 0, 0)
		expect(startOfMonthMs(t)).toBe(expected)
	})

	it('handles New Years Eve correctly', () => {
		const t = Date.UTC(2026, 11, 31, 23, 59, 59)
		expect(startOfMonthMs(t)).toBe(Date.UTC(2026, 11, 1, 0, 0, 0))
	})
})

describe('byok-fee.isPastFreeTier', () => {
	it('inclusive of the boundary value', () => {
		expect(isPastFreeTier(FREE_BYOK_REQUESTS_PER_MONTH - 1)).toBe(false)
		expect(isPastFreeTier(FREE_BYOK_REQUESTS_PER_MONTH)).toBe(true)
		expect(isPastFreeTier(FREE_BYOK_REQUESTS_PER_MONTH + 1)).toBe(true)
	})
})

describe('byok-fee.feeCentsForNextByokRequest', () => {
	it('charges nothing while inside the free tier', () => {
		expect(feeCentsForNextByokRequest(0)).toBe(0)
		expect(feeCentsForNextByokRequest(500)).toBe(0)
		expect(feeCentsForNextByokRequest(FREE_BYOK_REQUESTS_PER_MONTH - 1)).toBe(0)
	})

	it('charges nothing for the first request past the free tier (off-batch)', () => {
		// currentByokCount = FREE = 1000, the (1001)st request, overage = 1, not a multiple of 10
		expect(feeCentsForNextByokRequest(FREE_BYOK_REQUESTS_PER_MONTH)).toBe(0)
	})

	it('charges 1¢ at every batch boundary past the free tier', () => {
		// (1010)th request: overage = 10 → charge.
		expect(feeCentsForNextByokRequest(FREE_BYOK_REQUESTS_PER_MONTH + BYOK_FEE_BATCH_SIZE - 1)).toBe(
			BYOK_FEE_CENTS_PER_BATCH,
		)
		// (1020)th, (1030)th ... all charge.
		expect(
			feeCentsForNextByokRequest(FREE_BYOK_REQUESTS_PER_MONTH + 2 * BYOK_FEE_BATCH_SIZE - 1),
		).toBe(BYOK_FEE_CENTS_PER_BATCH)
		expect(
			feeCentsForNextByokRequest(FREE_BYOK_REQUESTS_PER_MONTH + 9 * BYOK_FEE_BATCH_SIZE - 1),
		).toBe(BYOK_FEE_CENTS_PER_BATCH)
	})

	it('charges nothing on the off-batch requests within the overage', () => {
		// Between batch boundaries — e.g. the 1015th request: overage = 15, not multiple of 10.
		expect(feeCentsForNextByokRequest(FREE_BYOK_REQUESTS_PER_MONTH + BYOK_FEE_BATCH_SIZE + 4)).toBe(
			0,
		)
	})

	it('amortized cost matches the documented $0.001/request', () => {
		// Run a synthetic month: free tier first, then 1000 more requests past.
		let total = 0
		for (let i = 0; i < FREE_BYOK_REQUESTS_PER_MONTH + 1000; i++) {
			total += feeCentsForNextByokRequest(i)
		}
		// After the free tier, 1000 more requests at 1¢ per 10 = 100¢ = $1.00.
		expect(total).toBe(100)
	})
})

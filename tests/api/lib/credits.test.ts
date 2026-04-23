import { describe, expect, it, vi } from 'vitest'
import { MARKUP_BPS, attemptDebit, computeMarkupCents } from '../../../apps/api/src/lib/credits'

describe('credits.computeMarkupCents', () => {
	it('computes 2.5% markup as the canonical MARKUP_BPS', () => {
		expect(MARKUP_BPS).toBe(250)
	})

	it('rounds up so partial cents never under-charge', () => {
		// 100¢ × 2.5% = 2.5¢ → ceil to 3¢
		expect(computeMarkupCents(100)).toBe(3)
	})

	it('returns 0 for zero cost', () => {
		expect(computeMarkupCents(0)).toBe(0)
	})

	it('returns 0 for negative input (defensive)', () => {
		expect(computeMarkupCents(-50)).toBe(0)
	})

	it('scales correctly for larger amounts', () => {
		// 10,000¢ × 2.5% = 250¢ exactly
		expect(computeMarkupCents(10_000)).toBe(250)
		// 400¢ × 2.5% = 10¢ exactly
		expect(computeMarkupCents(400)).toBe(10)
	})

	it('rounds up even tiny fractions', () => {
		// 1¢ × 2.5% = 0.025¢ → ceil to 1¢
		expect(computeMarkupCents(1)).toBe(1)
	})
})

describe('credits.attemptDebit', () => {
	// NOTE: full end-to-end atomicity against D1 is covered by the integration
	// test in tests/api/routes/proxy-credits.test.ts (added in Phase 7 alongside
	// miniflare setup). These unit tests verify the function's handling of the
	// D1 driver's meta response shape.

	function mockDb(runResult: { rows_written?: number; changes?: number }) {
		return {
			run: vi.fn().mockResolvedValue({ meta: runResult }),
		} as unknown as Parameters<typeof attemptDebit>[0]
	}

	it('returns true when rows_written >= 1', async () => {
		const db = mockDb({ rows_written: 1 })
		expect(await attemptDebit(db, 'user-1', 100)).toBe(true)
	})

	it('returns false when rows_written is 0 (guard blocked the update)', async () => {
		const db = mockDb({ rows_written: 0 })
		expect(await attemptDebit(db, 'user-1', 100)).toBe(false)
	})

	it('falls back to `changes` if `rows_written` missing (older drizzle builds)', async () => {
		const db = mockDb({ changes: 1 })
		expect(await attemptDebit(db, 'user-1', 100)).toBe(true)
	})

	it('short-circuits true for zero debit (no DB call)', async () => {
		const db = mockDb({ rows_written: 0 })
		expect(await attemptDebit(db, 'user-1', 0)).toBe(true)
		expect((db as unknown as { run: { mock: { calls: unknown[] } } }).run.mock.calls).toHaveLength(
			0,
		)
	})

	it('short-circuits true for negative debit (defensive)', async () => {
		const db = mockDb({ rows_written: 0 })
		expect(await attemptDebit(db, 'user-1', -5)).toBe(true)
	})
})

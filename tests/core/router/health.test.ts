import {
	BASE_COOLDOWN_MS,
	type DemotionMap,
	FAILURE_THRESHOLD,
	FAILURE_WINDOW_MS,
	MAX_COOLDOWN_MS,
	filterDemoted,
	purgeExpired,
	recordFailure,
	recordSuccess,
} from '@edgerouteai/core/router/health'
import { describe, expect, it } from 'vitest'

const BASE_NOW = 1_700_000_000_000 // arbitrary fixed "now" for determinism

describe('health.filterDemoted', () => {
	it('returns ranking unchanged when map is empty', () => {
		const ranking = ['openai/gpt-4o', 'anthropic/claude-sonnet-4-6']
		expect(filterDemoted(ranking, {}, BASE_NOW)).toEqual(ranking)
	})

	it('returns ranking unchanged when map is undefined', () => {
		const ranking = ['openai/gpt-4o']
		expect(filterDemoted(ranking, undefined, BASE_NOW)).toEqual(ranking)
	})

	it('drops models with active cooldown', () => {
		const map: DemotionMap = {
			'openai/gpt-4o': {
				failureCount: 3,
				lastFailureMs: BASE_NOW - 1000,
				cooldownUntilMs: BASE_NOW + 60_000,
			},
		}
		const ranking = ['openai/gpt-4o', 'anthropic/claude-sonnet-4-6']
		expect(filterDemoted(ranking, map, BASE_NOW)).toEqual(['anthropic/claude-sonnet-4-6'])
	})

	it('keeps models whose cooldown has expired', () => {
		const map: DemotionMap = {
			'openai/gpt-4o': {
				failureCount: 3,
				lastFailureMs: BASE_NOW - 10_000_000,
				cooldownUntilMs: BASE_NOW - 60_000, // expired
			},
		}
		const ranking = ['openai/gpt-4o']
		expect(filterDemoted(ranking, map, BASE_NOW)).toEqual(['openai/gpt-4o'])
	})
})

describe('health.recordFailure', () => {
	it('ignores non-retryable statuses (400, 401, 404)', () => {
		const before: DemotionMap = {}
		for (const status of [400, 401, 404, 422]) {
			const after = recordFailure(before, 'openai/gpt-4o', BASE_NOW, status)
			expect(after).toBe(before)
		}
	})

	it('records 429 and 5xx failures', () => {
		for (const status of [429, 500, 502, 503, 504]) {
			const after = recordFailure({}, 'openai/gpt-4o', BASE_NOW, status)
			expect(after['openai/gpt-4o']).toBeDefined()
			expect(after['openai/gpt-4o'].failureCount).toBe(1)
		}
	})

	it('does not enter cooldown before threshold', () => {
		let map: DemotionMap = {}
		for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
			map = recordFailure(map, 'openai/gpt-4o', BASE_NOW + i * 1000, 503)
		}
		expect(map['openai/gpt-4o'].failureCount).toBe(FAILURE_THRESHOLD - 1)
		expect(map['openai/gpt-4o'].cooldownUntilMs).toBe(0)
	})

	it('enters cooldown at exactly the threshold', () => {
		let map: DemotionMap = {}
		for (let i = 0; i < FAILURE_THRESHOLD; i++) {
			map = recordFailure(map, 'openai/gpt-4o', BASE_NOW + i * 1000, 503)
		}
		const entry = map['openai/gpt-4o']
		expect(entry.failureCount).toBe(FAILURE_THRESHOLD)
		expect(entry.cooldownUntilMs).toBeGreaterThan(BASE_NOW)
		expect(entry.cooldownUntilMs - BASE_NOW - (FAILURE_THRESHOLD - 1) * 1000).toBeCloseTo(
			BASE_COOLDOWN_MS,
			-1,
		)
	})

	it('backs off exponentially past the threshold', () => {
		let map: DemotionMap = {}
		const nows: number[] = []
		for (let i = 0; i < FAILURE_THRESHOLD + 2; i++) {
			const t = BASE_NOW + i * 1000
			nows.push(t)
			map = recordFailure(map, 'openai/gpt-4o', t, 503)
		}
		const entry = map['openai/gpt-4o']
		const lastT = nows[nows.length - 1]
		// At 2 failures above threshold, cooldown is 4x base (base * 2^2)
		expect(entry.cooldownUntilMs - lastT).toBeLessThanOrEqual(4 * BASE_COOLDOWN_MS)
	})

	it('caps cooldown at MAX_COOLDOWN_MS', () => {
		let map: DemotionMap = {}
		for (let i = 0; i < 30; i++) {
			map = recordFailure(map, 'openai/gpt-4o', BASE_NOW + i * 1000, 503)
		}
		const entry = map['openai/gpt-4o']
		const lastT = BASE_NOW + 29 * 1000
		expect(entry.cooldownUntilMs - lastT).toBeLessThanOrEqual(MAX_COOLDOWN_MS)
	})

	it('resets count after the rolling window passes (measured from last failure)', () => {
		let map: DemotionMap = {}
		map = recordFailure(map, 'openai/gpt-4o', BASE_NOW, 503)
		const lastT = BASE_NOW + 1000
		map = recordFailure(map, 'openai/gpt-4o', lastT, 503)
		expect(map['openai/gpt-4o'].failureCount).toBe(2)

		// Window is measured from the most-recent failure, so add the window to lastT.
		const farFuture = lastT + FAILURE_WINDOW_MS + 1
		map = recordFailure(map, 'openai/gpt-4o', farFuture, 503)
		expect(map['openai/gpt-4o'].failureCount).toBe(1)
	})

	it('does not mutate input map', () => {
		const before: DemotionMap = {
			'openai/gpt-4o': { failureCount: 1, lastFailureMs: BASE_NOW - 1000, cooldownUntilMs: 0 },
		}
		const snapshot = JSON.stringify(before)
		const after = recordFailure(before, 'openai/gpt-4o', BASE_NOW, 503)
		expect(JSON.stringify(before)).toBe(snapshot)
		expect(after).not.toBe(before)
	})
})

describe('health.recordSuccess', () => {
	it('removes the demotion entry for the model', () => {
		const before: DemotionMap = {
			'openai/gpt-4o': { failureCount: 3, lastFailureMs: BASE_NOW, cooldownUntilMs: BASE_NOW },
			'anthropic/claude': { failureCount: 1, lastFailureMs: BASE_NOW, cooldownUntilMs: 0 },
		}
		const after = recordSuccess(before, 'openai/gpt-4o', BASE_NOW)
		expect(after['openai/gpt-4o']).toBeUndefined()
		expect(after['anthropic/claude']).toBeDefined()
	})

	it('is a no-op when the model has no entry', () => {
		const before: DemotionMap = {
			'anthropic/claude': { failureCount: 1, lastFailureMs: BASE_NOW, cooldownUntilMs: 0 },
		}
		const after = recordSuccess(before, 'openai/gpt-4o', BASE_NOW)
		expect(after).toEqual(before)
	})
})

describe('health.purgeExpired', () => {
	it('removes entries whose last-failure + TTL has passed', () => {
		const ancient = BASE_NOW - MAX_COOLDOWN_MS - FAILURE_WINDOW_MS - 1000
		const before: DemotionMap = {
			'old/m': { failureCount: 1, lastFailureMs: ancient, cooldownUntilMs: 0 },
			'fresh/m': { failureCount: 1, lastFailureMs: BASE_NOW, cooldownUntilMs: 0 },
		}
		const after = purgeExpired(before, BASE_NOW)
		expect(after['old/m']).toBeUndefined()
		expect(after['fresh/m']).toBeDefined()
	})

	it('keeps entries still in cooldown even if last-failure is old', () => {
		// lastFailure is ancient but cooldownUntilMs is in the future — happens
		// if the entry crossed max cooldown and we haven't seen new failures yet.
		const ancient = BASE_NOW - MAX_COOLDOWN_MS - FAILURE_WINDOW_MS - 1000
		const before: DemotionMap = {
			'weird/m': {
				failureCount: 10,
				lastFailureMs: ancient,
				cooldownUntilMs: BASE_NOW + 10_000,
			},
		}
		const after = purgeExpired(before, BASE_NOW)
		expect(after['weird/m']).toBeDefined()
	})

	it('returns the same reference when nothing is purged', () => {
		const before: DemotionMap = {
			'fresh/m': { failureCount: 1, lastFailureMs: BASE_NOW, cooldownUntilMs: 0 },
		}
		const after = purgeExpired(before, BASE_NOW)
		expect(after).toBe(before)
	})
})

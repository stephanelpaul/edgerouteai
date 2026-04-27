// Rolling failure / latency tracker for the router.
//
// When a route fails with a retryable error (429, 5xx) we record the failure
// and, once the count in a rolling window crosses a threshold, demote the
// model for an exponentially-backed-off cooldown so the router stops picking
// it. After the cooldown expires the model rejoins the ranking automatically.
//
// This module is pure — no I/O. Callers (the gateway) are responsible for
// persisting the DemotionMap to KV and loading it on each request. Keeping
// these helpers pure makes them trivial to unit-test and reusable across
// different storage backends (KV, DO, Redis, in-memory for tests).

/** A single model's recent-failure state. */
export interface DemotionEntry {
	/** Rolling count of failures in the last FAILURE_WINDOW_MS. */
	failureCount: number
	/** Timestamp (ms) of the most recent failure. */
	lastFailureMs: number
	/** Model is demoted until this timestamp (ms). 0 if not currently demoted. */
	cooldownUntilMs: number
}

/** Map of "provider/modelId" → DemotionEntry. */
export type DemotionMap = Record<string, DemotionEntry>

/** Rolling window for failure counting. */
export const FAILURE_WINDOW_MS = 5 * 60 * 1000

/** Cool down starts after this many failures inside the rolling window. */
export const FAILURE_THRESHOLD = 3

/** Base cooldown duration once threshold is crossed. */
export const BASE_COOLDOWN_MS = 5 * 60 * 1000

/** Cap on cooldown so a permanently-flaky model doesn't get stuck forever. */
export const MAX_COOLDOWN_MS = 30 * 60 * 1000

/** Entries older than this can be purged from the map (keeps KV blob small). */
export const ENTRY_TTL_MS = MAX_COOLDOWN_MS + FAILURE_WINDOW_MS

/**
 * Filter a ranking to exclude models currently in cooldown. Pure; the map is
 * not mutated. Returns the ranking unchanged if demotions is empty/undefined.
 */
export function filterDemoted(
	ranking: string[],
	demotions: DemotionMap | undefined,
	nowMs: number,
): string[] {
	if (!demotions) return ranking
	return ranking.filter((m) => {
		const entry = demotions[m]
		if (!entry) return true
		return entry.cooldownUntilMs <= nowMs
	})
}

/**
 * Update the map for a single failure. Pure: returns a new map, doesn't
 * mutate the input. If this failure pushes the rolling count over the
 * threshold, the cooldown is (re)started with exponential backoff.
 *
 * Retryable HTTP statuses (429, 5xx) count; anything else is a no-op because
 * non-retryable errors (400, 401, 404) are the user's fault, not the model's.
 */
export function recordFailure(
	current: DemotionMap,
	modelKey: string,
	nowMs: number,
	statusCode: number,
): DemotionMap {
	const isRetryable = statusCode === 429 || (statusCode >= 500 && statusCode < 600)
	if (!isRetryable) return current

	// Expire stale entries and stale failure windows.
	const cleaned = purgeExpired(current, nowMs)
	const existing = cleaned[modelKey]

	// Failure counts decay: if the last failure was > window ago, reset to 1.
	const stillInWindow = existing && nowMs - existing.lastFailureMs < FAILURE_WINDOW_MS
	const newCount = stillInWindow ? existing.failureCount + 1 : 1

	let cooldownUntilMs = existing?.cooldownUntilMs ?? 0
	if (newCount >= FAILURE_THRESHOLD) {
		// Exponential backoff: 5min at threshold, 10min at threshold+1, etc.
		// `extra` is the count above the threshold, clamped so the shift stays finite.
		const extra = Math.min(newCount - FAILURE_THRESHOLD, 10)
		const backoff = Math.min(BASE_COOLDOWN_MS * 2 ** extra, MAX_COOLDOWN_MS)
		cooldownUntilMs = nowMs + backoff
	}

	return {
		...cleaned,
		[modelKey]: {
			failureCount: newCount,
			lastFailureMs: nowMs,
			cooldownUntilMs,
		},
	}
}

/**
 * Clear a successful model's demotion state. A success inside a cooldown is
 * rare (we wouldn't have picked the model) but can happen if another request
 * raced us to refresh the map.
 */
export function recordSuccess(current: DemotionMap, modelKey: string, nowMs: number): DemotionMap {
	const cleaned = purgeExpired(current, nowMs)
	if (!cleaned[modelKey]) return cleaned
	const { [modelKey]: _removed, ...rest } = cleaned
	return rest
}

/** Purge entries whose last-failure is older than ENTRY_TTL_MS. */
export function purgeExpired(map: DemotionMap, nowMs: number): DemotionMap {
	const cutoff = nowMs - ENTRY_TTL_MS
	let changed = false
	const out: DemotionMap = {}
	for (const [key, entry] of Object.entries(map)) {
		if (entry.lastFailureMs >= cutoff || entry.cooldownUntilMs > nowMs) {
			out[key] = entry
		} else {
			changed = true
		}
	}
	return changed ? out : map
}

/** Format a "provider/modelId" key from components. */
export function modelKey(provider: string, modelId: string): string {
	return `${provider}/${modelId}`
}

import { type DemotionMap, purgeExpired, recordFailure } from '@edgerouteai/core/router/health'

// Single KV key that holds the whole demotion map as JSON. One GET per
// request, one PUT per failure — the map is small (≤ number of models we
// know about, typically under 30 entries) so this is cheaper than N keys
// with individual TTLs.
const KV_KEY = 'router:demotions'
// KV-level TTL: if nothing writes for an hour, auto-evict.
const KV_TTL_SECONDS = 60 * 60

/**
 * Read the current demotion map from KV. Returns an empty map on cold start
 * or parse errors — the router treats that as "no demotions" which is the
 * safe default.
 */
export async function getDemotions(kv: KVNamespace): Promise<DemotionMap> {
	try {
		const raw = await kv.get(KV_KEY, 'json')
		if (!raw || typeof raw !== 'object') return {}
		return raw as DemotionMap
	} catch {
		return {}
	}
}

/**
 * Record a failure in KV. Read-modify-write; racy across concurrent workers
 * but that's acceptable here — the worst case is one record is lost, which
 * just delays cooldown activation by one more failure. The cooldown
 * threshold of 3 failures makes this robust enough.
 */
export async function recordFailureKv(
	kv: KVNamespace,
	provider: string,
	modelId: string,
	statusCode: number,
	nowMs: number = Date.now(),
): Promise<void> {
	const current = await getDemotions(kv)
	const updated = recordFailure(current, `${provider}/${modelId}`, nowMs, statusCode)
	if (updated === current) return // no-op (non-retryable status)
	await kv.put(KV_KEY, JSON.stringify(updated), { expirationTtl: KV_TTL_SECONDS })
}

/**
 * Opportunistically purge expired entries. Can be called on any successful
 * request — cheap if nothing's expired.
 */
export async function purgeExpiredKv(kv: KVNamespace, nowMs: number = Date.now()): Promise<void> {
	const current = await getDemotions(kv)
	const cleaned = purgeExpired(current, nowMs)
	if (cleaned !== current) {
		await kv.put(KV_KEY, JSON.stringify(cleaned), { expirationTtl: KV_TTL_SECONDS })
	}
}

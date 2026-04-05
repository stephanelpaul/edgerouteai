import { RateLimitError } from '@edgerouteai/shared'
import { createMiddleware } from 'hono/factory'
import type { AppContext } from '../lib/env.js'

interface TokenBucket {
	tokens: number
	lastRefill: number
}

const DEFAULT_RATE_LIMIT = 60

export async function checkRateLimit(
	kv: KVNamespace,
	keyId: string,
	maxTokens: number,
): Promise<{ allowed: boolean; remaining: number }> {
	const kvKey = `rl:${keyId}`
	const raw = await kv.get(kvKey)
	const bucket: TokenBucket = raw ? JSON.parse(raw) : { tokens: maxTokens, lastRefill: Date.now() }
	const now = Date.now()
	const elapsed = now - bucket.lastRefill
	const refill = Math.floor((elapsed / 60_000) * maxTokens)
	if (refill > 0) {
		bucket.tokens = Math.min(maxTokens, bucket.tokens + refill)
		bucket.lastRefill = now
	}
	if (bucket.tokens <= 0) {
		await kv.put(kvKey, JSON.stringify(bucket), { expirationTtl: 120 })
		return { allowed: false, remaining: 0 }
	}
	bucket.tokens -= 1
	await kv.put(kvKey, JSON.stringify(bucket), { expirationTtl: 120 })
	return { allowed: true, remaining: bucket.tokens }
}

export const rateLimitMiddleware = createMiddleware<AppContext>(async (c, next) => {
	const apiKeyId = c.get('apiKeyId')
	const { allowed, remaining } = await checkRateLimit(
		c.env.RATE_LIMIT,
		apiKeyId,
		DEFAULT_RATE_LIMIT,
	)
	c.header('X-RateLimit-Limit', String(DEFAULT_RATE_LIMIT))
	c.header('X-RateLimit-Remaining', String(remaining))
	if (!allowed) throw new RateLimitError()
	await next()
})

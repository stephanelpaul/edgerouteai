import type { Database } from '@edgerouteai/db'
import { requestLogs, usageLedger } from '@edgerouteai/db'
import { and, count, eq, gte } from 'drizzle-orm'

// BYOK platform fee — billing model:
//
//   Self-hosted users:        free, no fees, FSL license.
//   Hosted BYOK, ≤1000/mo:    free.
//   Hosted BYOK, >1000/mo:    $0.001/request (= $1 per 1000 requests).
//   Hosted platform-keyed:    cost + 2.5% markup, every request.
//
// To avoid a sub-cent column on user_credits, the BYOK fee is BATCHED:
// every BYOK_FEE_BATCH_SIZE requests past the free tier, we debit 1 cent
// from the credit balance. Effective per-request cost averages
// 1¢ / BYOK_FEE_BATCH_SIZE = $0.001/request at BATCH_SIZE=10.
//
// (Originally quoted at $0.0001/req, but charging fractional cents requires
// a sub-cent balance schema. Going 10x via this batching keeps the number
// clean and matches indie-SaaS pricing norms — communicated as
// "$1 per 1000 BYOK requests above the free tier".)

export const FREE_BYOK_REQUESTS_PER_MONTH = 1000
export const BYOK_FEE_BATCH_SIZE = 10
export const BYOK_FEE_CENTS_PER_BATCH = 1 // 1¢ per 10 requests = $0.001/req

/** UTC start-of-month timestamp for `now`. */
export function startOfMonthMs(now: number = Date.now()): number {
	const d = new Date(now)
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0)
}

/**
 * Count this calendar month's BYOK requests for a user. We don't have a
 * "used_platform_key" flag on request_logs (intentionally — adding columns is
 * disruptive), so we derive it: every platform-keyed request creates a
 * `usage_ledger` row, so BYOK count = total requestLogs - ledger count for
 * the same month/user.
 *
 * Both queries are indexed on (user_id, created_at) so this is two cheap
 * aggregate scans, not a join.
 */
export async function getMonthlyByokCount(db: Database, userId: string): Promise<number> {
	const since = new Date(startOfMonthMs())
	const [totalRow] = await db
		.select({ c: count() })
		.from(requestLogs)
		.where(and(eq(requestLogs.userId, userId), gte(requestLogs.createdAt, since)))
	const [ledgerRow] = await db
		.select({ c: count() })
		.from(usageLedger)
		.where(and(eq(usageLedger.userId, userId), gte(usageLedger.createdAt, since)))
	const total = totalRow?.c ?? 0
	const ledger = ledgerRow?.c ?? 0
	return Math.max(0, total - ledger)
}

/** True if a user with N BYOK requests this month is past the free tier. */
export function isPastFreeTier(byokCount: number): boolean {
	return byokCount >= FREE_BYOK_REQUESTS_PER_MONTH
}

/**
 * Returns the cents to debit for the (n+1)th BYOK request, given that the
 * user already has `currentByokCount` BYOK requests recorded this month.
 * Zero unless the new request lands on a batch boundary above the free tier.
 */
export function feeCentsForNextByokRequest(currentByokCount: number): number {
	const newCount = currentByokCount + 1
	if (newCount <= FREE_BYOK_REQUESTS_PER_MONTH) return 0
	const overage = newCount - FREE_BYOK_REQUESTS_PER_MONTH
	return overage % BYOK_FEE_BATCH_SIZE === 0 ? BYOK_FEE_CENTS_PER_BATCH : 0
}

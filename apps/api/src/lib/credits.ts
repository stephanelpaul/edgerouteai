import type { Database } from '@edgerouteai/db'
import { userCredits } from '@edgerouteai/db'
import { eq, sql } from 'drizzle-orm'

// 2.5% markup expressed as basis points (1 bp = 0.01%).
// Held as a const so the gateway math is auditable from this one place.
export const MARKUP_BPS = 250

/**
 * Compute the markup in integer cents for a given raw provider cost.
 * Always rounds up so we never under-charge by a fraction of a cent.
 */
export function computeMarkupCents(costCents: number): number {
	if (costCents <= 0) return 0
	return Math.ceil((costCents * MARKUP_BPS) / 10_000)
}

/**
 * Atomically decrement the user's balance by `totalDebitCents`.
 * Returns true if the debit succeeded, false if the user didn't have enough
 * balance (in which case nothing was written).
 *
 * Relies on D1's single-statement atomicity: the WHERE clause guards against
 * going negative, and the `rows_written` meta tells us which branch ran.
 */
export async function attemptDebit(
	db: Database,
	userId: string,
	totalDebitCents: number,
): Promise<boolean> {
	if (totalDebitCents <= 0) return true
	const now = Date.now()
	const result = await db.run(
		sql`UPDATE user_credits
		    SET balance_cents = balance_cents - ${totalDebitCents},
		        lifetime_spent_cents = lifetime_spent_cents + ${totalDebitCents},
		        updated_at = ${now}
		    WHERE user_id = ${userId}
		      AND balance_cents >= ${totalDebitCents}`,
	)
	const meta = result.meta as { rows_written?: number; changes?: number } | undefined
	return (meta?.rows_written ?? meta?.changes ?? 0) >= 1
}

/**
 * Read the user's current balance. Returns 0 if no row exists (un-onboarded user).
 */
export async function getBalanceCents(db: Database, userId: string): Promise<number> {
	const [row] = await db.select().from(userCredits).where(eq(userCredits.userId, userId)).limit(1)
	return row?.balanceCents ?? 0
}

/**
 * Create a zero-balance row for a user if they don't have one yet.
 * Called at first login / first API request; safe to call repeatedly.
 */
export async function ensureCreditsRow(db: Database, userId: string): Promise<void> {
	await db
		.insert(userCredits)
		.values({
			userId,
			balanceCents: 0,
			lifetimeToppedUpCents: 0,
			lifetimeSpentCents: 0,
			updatedAt: new Date(),
		})
		.onConflictDoNothing()
}

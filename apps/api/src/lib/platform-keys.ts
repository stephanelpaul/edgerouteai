import type { Database } from '@edgerouteai/db'
import { platformUpstreamKeys } from '@edgerouteai/db'
import { and, eq } from 'drizzle-orm'
import { decrypt } from './crypto.js'

/**
 * Return a decrypted platform-owned upstream API key for the given provider,
 * or null if no active key is configured.
 *
 * When multiple keys exist for the same provider we pick one at random — this
 * gives us cheap load-balancing across the provider's rate limits for free.
 */
export async function getPlatformKeyFor(
	db: Database,
	provider: string,
	encryptionKey: string,
): Promise<string | null> {
	const rows = await db
		.select()
		.from(platformUpstreamKeys)
		.where(
			and(eq(platformUpstreamKeys.provider, provider), eq(platformUpstreamKeys.isActive, true)),
		)
	if (rows.length === 0) return null
	const pick = rows[Math.floor(Math.random() * rows.length)]
	return decrypt(
		pick.encryptedKey as unknown as ArrayBuffer,
		pick.iv as unknown as Uint8Array,
		encryptionKey,
	)
}

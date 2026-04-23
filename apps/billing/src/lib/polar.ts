// Minimal Polar.sh client. We only need two things from Polar:
//   1) Create a one-time checkout session for a given product
//   2) Verify the signature on inbound webhook events
// The rest of Polar's SDK (customers, subscriptions, products API) isn't used.
// Pulling @polar-sh/sdk just for 2 calls is heavy for a Worker bundle, so we
// use raw fetch and Web Crypto HMAC.

import type { BillingEnv } from './env.js'

const POLAR_API_BASE = 'https://api.polar.sh'

export interface CheckoutResponse {
	id: string
	url: string
}

/** Credit pack map: USD → product-id env var name + cents amount. */
export const CREDIT_PACKS = {
	5: { productIdKey: 'POLAR_PRODUCT_PACK_5', amountCents: 500 },
	20: { productIdKey: 'POLAR_PRODUCT_PACK_20', amountCents: 2000 },
	50: { productIdKey: 'POLAR_PRODUCT_PACK_50', amountCents: 5000 },
	100: { productIdKey: 'POLAR_PRODUCT_PACK_100', amountCents: 10_000 },
} as const

export type PackSize = keyof typeof CREDIT_PACKS
export const PACK_SIZES = [5, 20, 50, 100] as const

export function isValidPackSize(n: unknown): n is PackSize {
	return n === 5 || n === 20 || n === 50 || n === 100
}

/**
 * Create a Polar checkout session. Returns the hosted-checkout URL and the
 * Polar session id. The user is redirected to `url` and completes payment on
 * Polar's domain; we're notified via webhook when they finish.
 */
export async function createCheckout(
	env: BillingEnv,
	opts: {
		userId: string
		userEmail: string
		packUsd: PackSize
		successUrl: string
		cancelUrl: string
	},
): Promise<CheckoutResponse> {
	const productId = env[CREDIT_PACKS[opts.packUsd].productIdKey]
	if (!productId) {
		throw new Error(`Polar product id not configured for ${opts.packUsd}-dollar pack`)
	}
	const res = await fetch(`${POLAR_API_BASE}/v1/checkouts/`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			products: [productId],
			customer_email: opts.userEmail,
			// user id + amount travel with the order so the webhook handler knows
			// who to credit and by how much, without another round-trip.
			metadata: {
				userId: opts.userId,
				packUsd: String(opts.packUsd),
				amountCents: String(CREDIT_PACKS[opts.packUsd].amountCents),
			},
			success_url: opts.successUrl,
			// Polar's hosted cancel page falls back to the default if we don't
			// pass one, so we only set success. Cancel url would go here if Polar
			// adds support; right now it's not in the checkout creation API.
		}),
	})
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Polar checkout failed: ${res.status} ${text}`)
	}
	const data = (await res.json()) as { id: string; url: string }
	return { id: data.id, url: data.url }
}

/**
 * Verify the signature on an inbound Polar webhook. Polar follows the
 * Standard Webhooks spec: HMAC-SHA256 of `{id}.{timestamp}.{body}` with the
 * webhook secret, base64-encoded, in the `webhook-signature` header as
 * `v1,<signature>`. The header may contain multiple comma-separated entries.
 *
 * See: https://docs.polar.sh/api-reference/webhooks
 */
export async function verifyWebhookSignature(opts: {
	id: string
	timestamp: string
	body: string
	signatureHeader: string
	secret: string
}): Promise<boolean> {
	const key = await crypto.subtle.importKey(
		'raw',
		// Standard Webhooks uses the secret as a base64-decoded buffer when it
		// starts with "whsec_". Polar documents `POLAR_WEBHOOK_SECRET` as the
		// literal "whsec_..." string, which is what they expect us to hash with.
		new TextEncoder().encode(opts.secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	)
	const signed = await crypto.subtle.sign(
		'HMAC',
		key,
		new TextEncoder().encode(`${opts.id}.${opts.timestamp}.${opts.body}`),
	)
	const computed = btoa(String.fromCharCode(...new Uint8Array(signed)))
	// Header may contain comma-separated signatures; each prefixed with `v1,`.
	const entries = opts.signatureHeader.split(' ')
	for (const entry of entries) {
		const [version, sig] = entry.split(',')
		if (version === 'v1' && sig === computed) return true
	}
	return false
}

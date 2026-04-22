import { describe, expect, it } from 'vitest'
import {
	CREDIT_PACKS,
	PACK_SIZES,
	isValidPackSize,
	verifyWebhookSignature,
} from '../../apps/billing/src/lib/polar'

describe('billing.polar.isValidPackSize', () => {
	it.each(PACK_SIZES)('accepts %d as a valid pack', (n) => {
		expect(isValidPackSize(n)).toBe(true)
	})

	it.each([0, 1, 7, 10, 25, 99, 101, 500, -5, null, undefined, 'five', '5'])('rejects %p', (n) => {
		expect(isValidPackSize(n)).toBe(false)
	})
})

describe('billing.polar.CREDIT_PACKS', () => {
	it('maps pack size to the correct integer cents amount', () => {
		expect(CREDIT_PACKS[5].amountCents).toBe(500)
		expect(CREDIT_PACKS[20].amountCents).toBe(2000)
		expect(CREDIT_PACKS[50].amountCents).toBe(5000)
		expect(CREDIT_PACKS[100].amountCents).toBe(10_000)
	})
})

describe('billing.polar.verifyWebhookSignature', () => {
	const secret = 'whsec_test_abcdef123456'
	const id = 'evt_123'
	const timestamp = '1714000000'
	const body = JSON.stringify({ type: 'order.paid', data: { metadata: { userId: 'u1' } } })

	async function sign(
		idStr: string,
		tsStr: string,
		bodyStr: string,
		secretStr: string,
	): Promise<string> {
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secretStr),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign'],
		)
		const sig = await crypto.subtle.sign(
			'HMAC',
			key,
			new TextEncoder().encode(`${idStr}.${tsStr}.${bodyStr}`),
		)
		return btoa(String.fromCharCode(...new Uint8Array(sig)))
	}

	it('accepts a valid signature', async () => {
		const computed = await sign(id, timestamp, body, secret)
		expect(
			await verifyWebhookSignature({
				id,
				timestamp,
				body,
				signatureHeader: `v1,${computed}`,
				secret,
			}),
		).toBe(true)
	})

	it('rejects a tampered body', async () => {
		const computed = await sign(id, timestamp, body, secret)
		expect(
			await verifyWebhookSignature({
				id,
				timestamp,
				body: `${body}tampered`,
				signatureHeader: `v1,${computed}`,
				secret,
			}),
		).toBe(false)
	})

	it('rejects a wrong secret', async () => {
		const computed = await sign(id, timestamp, body, 'whsec_wrong')
		expect(
			await verifyWebhookSignature({
				id,
				timestamp,
				body,
				signatureHeader: `v1,${computed}`,
				secret,
			}),
		).toBe(false)
	})

	it('rejects unknown version prefix', async () => {
		const computed = await sign(id, timestamp, body, secret)
		expect(
			await verifyWebhookSignature({
				id,
				timestamp,
				body,
				signatureHeader: `v2,${computed}`,
				secret,
			}),
		).toBe(false)
	})

	it('accepts any of multiple space-separated signatures', async () => {
		const real = await sign(id, timestamp, body, secret)
		// Polar rotates keys by sending v1,<old> v1,<new> — we should accept
		// whichever one matches our current secret.
		expect(
			await verifyWebhookSignature({
				id,
				timestamp,
				body,
				signatureHeader: `v1,junk v1,${real}`,
				secret,
			}),
		).toBe(true)
	})
})

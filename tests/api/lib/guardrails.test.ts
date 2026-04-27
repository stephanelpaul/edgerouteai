import type { ChatMessage } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'
import {
	type GuardrailConfig,
	parseGuardrailConfig,
	scanMessages,
} from '../../../apps/api/src/lib/guardrails'

function userMsg(content: string): ChatMessage {
	return { role: 'user', content }
}

describe('guardrails.scanMessages: PII', () => {
	const piiConfig: GuardrailConfig = {
		blockPii: { categories: ['email', 'phone', 'ssn', 'creditcard'] },
		applyTo: 'input',
	}

	it('matches an email address', () => {
		const m = scanMessages([userMsg('contact alice@example.com please')], [piiConfig], 'input')
		expect(m?.type).toBe('pii')
		expect(m?.category).toBe('email')
	})

	it('matches a SSN with dashes', () => {
		const m = scanMessages([userMsg('SSN is 123-45-6789')], [piiConfig], 'input')
		expect(m?.type).toBe('pii')
		expect(m?.category).toBe('ssn')
	})

	it('does NOT match SSN without dashes (too generic)', () => {
		const m = scanMessages(
			[userMsg('phone 1234567890')],
			[
				{
					blockPii: { categories: ['ssn'] },
					applyTo: 'input',
				},
			],
			'input',
		)
		expect(m).toBeNull()
	})

	it('matches a credit-card-shaped number', () => {
		const m = scanMessages(
			[userMsg('My card is 4242 4242 4242 4242')],
			[{ blockPii: { categories: ['creditcard'] }, applyTo: 'input' }],
			'input',
		)
		expect(m?.type).toBe('pii')
		expect(m?.category).toBe('creditcard')
	})

	it('does not match clean text', () => {
		const m = scanMessages([userMsg('Hello, world!')], [piiConfig], 'input')
		expect(m).toBeNull()
	})

	it('only checks enabled categories', () => {
		const m = scanMessages(
			[userMsg('reach me at alice@example.com')],
			[{ blockPii: { categories: ['ssn'] }, applyTo: 'input' }],
			'input',
		)
		expect(m).toBeNull()
	})

	it('truncates long matches in the excerpt', () => {
		const long = `${'x'.repeat(100)}@example.com`
		const m = scanMessages([userMsg(long)], [piiConfig], 'input')
		expect(m?.excerpt.length).toBeLessThanOrEqual(80)
	})
})

describe('guardrails.scanMessages: keywords', () => {
	const config: GuardrailConfig = {
		blockedKeywords: ['secret', 'classified'],
		applyTo: 'input',
	}

	it('matches a blocked keyword (case-insensitive)', () => {
		const m = scanMessages([userMsg('this is a SECRET message')], [config], 'input')
		expect(m?.type).toBe('keyword')
		expect(m?.keyword).toBe('secret')
	})

	it('does not match clean text', () => {
		const m = scanMessages([userMsg('this is fine')], [config], 'input')
		expect(m).toBeNull()
	})

	it('skips empty/whitespace-only blocklist entries', () => {
		const m = scanMessages(
			[userMsg('hello')],
			[{ blockedKeywords: ['  ', ''], applyTo: 'input' }],
			'input',
		)
		expect(m).toBeNull()
	})

	it('scans across multiple messages', () => {
		const m = scanMessages(
			[userMsg('hello'), userMsg('world contains secret data')],
			[config],
			'input',
		)
		expect(m?.keyword).toBe('secret')
	})
})

describe('guardrails.scanMessages: scope', () => {
	it('input-scoped rules skip output scans', () => {
		const m = scanMessages(
			[userMsg('email me at bob@example.com')],
			[{ blockPii: { categories: ['email'] }, applyTo: 'input' }],
			'output',
		)
		expect(m).toBeNull()
	})

	it('output-scoped rules skip input scans', () => {
		const m = scanMessages(
			[userMsg('email me at bob@example.com')],
			[{ blockPii: { categories: ['email'] }, applyTo: 'output' }],
			'input',
		)
		expect(m).toBeNull()
	})

	it('"both" applies to either scope', () => {
		const config: GuardrailConfig = {
			blockPii: { categories: ['email'] },
			applyTo: 'both',
		}
		expect(scanMessages([userMsg('a@b.cd')], [config], 'input')?.type).toBe('pii')
		expect(scanMessages([userMsg('a@b.cd')], [config], 'output')?.type).toBe('pii')
	})
})

describe('guardrails.parseGuardrailConfig', () => {
	it('parses a valid config string', () => {
		const c = parseGuardrailConfig(JSON.stringify({ blockedKeywords: ['x'], applyTo: 'input' }))
		expect(c?.blockedKeywords).toEqual(['x'])
	})

	it('defaults applyTo to "input" when missing', () => {
		const c = parseGuardrailConfig(JSON.stringify({ blockedKeywords: ['x'] }))
		expect(c?.applyTo).toBe('input')
	})

	it('returns null on malformed JSON', () => {
		expect(parseGuardrailConfig('not json')).toBeNull()
	})
})

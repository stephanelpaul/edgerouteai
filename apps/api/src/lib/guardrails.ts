// Guardrails: per-API-key safety rules. MVP supports two rule types:
//
//   1. PII regex matching for: email, phone, SSN, credit card.
//   2. Keyword blocklist (case-insensitive substring match).
//
// Both apply to the inbound request's message contents. Output-side scanning
// is a separate concern (requires intercepting the streaming response) and
// is deferred to v2 of guardrails.
//
// Action is implicit: BLOCK. Future: redact/transform.

import type { ChatMessage } from '@edgerouteai/shared'

export type PiiCategory = 'email' | 'phone' | 'ssn' | 'creditcard'
export type GuardrailScope = 'input' | 'output' | 'both'

export interface GuardrailConfig {
	blockPii?: { categories: PiiCategory[] }
	blockedKeywords?: string[]
	applyTo: GuardrailScope
}

export interface GuardrailMatch {
	type: 'pii' | 'keyword'
	category?: PiiCategory
	keyword?: string
	excerpt: string
}

// PII regexes. Intentionally conservative to avoid false-positives on,
// e.g., "1234567890" being flagged as a phone number on its own.
const PII_PATTERNS: Record<PiiCategory, RegExp> = {
	// Standard email: word-chars + @ + dotted domain.
	email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
	// E.164-ish phone: optional +, country, 7-15 digits, with separators allowed.
	phone: /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-]?)\d{3,4}[\s.-]?\d{3,4}\b/g,
	// US SSN: 3-2-4 with dashes. The no-dashes form is too generic to flag.
	ssn: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
	// Credit-card-ish: 13-19 digits with optional separators.
	creditcard: /\b(?:\d[ -]*?){13,19}\b/g,
}

function findMatch(text: string, pattern: RegExp): RegExpExecArray | null {
	pattern.lastIndex = 0
	return pattern.exec(text)
}

function scanString(text: string, config: GuardrailConfig): GuardrailMatch | null {
	if (config.blockPii?.categories?.length) {
		for (const cat of config.blockPii.categories) {
			const pattern = PII_PATTERNS[cat]
			if (!pattern) continue
			const m = findMatch(text, pattern)
			if (m) {
				return {
					type: 'pii',
					category: cat,
					excerpt: m[0].length > 80 ? `${m[0].slice(0, 77)}...` : m[0],
				}
			}
		}
	}
	if (config.blockedKeywords?.length) {
		const lower = text.toLowerCase()
		for (const kw of config.blockedKeywords) {
			const needle = kw.toLowerCase().trim()
			if (!needle) continue
			const idx = lower.indexOf(needle)
			if (idx >= 0) {
				const start = Math.max(0, idx - 10)
				const end = Math.min(text.length, idx + needle.length + 10)
				return {
					type: 'keyword',
					keyword: kw,
					excerpt: text.slice(start, end),
				}
			}
		}
	}
	return null
}

/**
 * Scan an array of chat messages against a list of guardrails. Returns the
 * first match found (rule order = config order). Null = clean.
 */
export function scanMessages(
	messages: ChatMessage[],
	guardrails: GuardrailConfig[],
	scope: 'input' | 'output',
): GuardrailMatch | null {
	for (const rail of guardrails) {
		if (rail.applyTo !== scope && rail.applyTo !== 'both') continue
		for (const msg of messages) {
			const content = typeof msg.content === 'string' ? msg.content : ''
			if (!content) continue
			const match = scanString(content, rail)
			if (match) return match
		}
	}
	return null
}

export function parseGuardrailConfig(rawJson: string): GuardrailConfig | null {
	try {
		const parsed = JSON.parse(rawJson) as GuardrailConfig
		if (!parsed.applyTo || !['input', 'output', 'both'].includes(parsed.applyTo)) {
			parsed.applyTo = 'input'
		}
		return parsed
	} catch {
		return null
	}
}

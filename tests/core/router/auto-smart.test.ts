import { autoRoute } from '@edgerouteai/core/router/auto'
import type { ChatMessage } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

function userMsg(content: string): ChatMessage {
	return { role: 'user', content }
}

// All five providers available so tests aren't accidentally constrained by
// provider filtering.
const ALL_PROVIDERS = ['openai', 'anthropic', 'google', 'mistral', 'xai']

describe('autoRoute: cost budget filter', () => {
	it('respects costBudgetPerMTok — a short question + $1/Mtok budget picks a cheap model', () => {
		// Short question with "?" triggers budget tier, which has cheap models.
		const result = autoRoute({
			messages: [userMsg('what is 2+2?')],
			availableProviders: ALL_PROVIDERS,
			costBudgetPerMTok: 1,
		})
		expect(result).not.toBeNull()
		// Must NOT be an expensive model.
		expect(result?.modelId).not.toBe('claude-opus-4-6')
		expect(result?.modelId).not.toBe('gpt-5.4')
	})

	it('raises the ceiling — $6/Mtok admits mid-tier quality models', () => {
		const result = autoRoute({
			messages: [userMsg('hello there')],
			availableProviders: ALL_PROVIDERS,
			costBudgetPerMTok: 6,
			tier: 'quality', // force quality ranking
		})
		expect(result).not.toBeNull()
		// At $6 avg: Opus (15), GPT-5.4 (8.75), Sonnet (9), GPT-5.2 (7.875),
		// GPT-4o (6.25) all filtered. Gemini Pro (5.5), GPT-5 (5.625), Grok (4),
		// Mistral Large (4) qualify. Ranking order picks Gemini Pro first.
		expect(result?.modelId).not.toBe('claude-opus-4-6')
		expect(result?.modelId).not.toBe('gpt-5.4')
		expect(result?.modelId).not.toBe('claude-sonnet-4-6')
	})

	it('returns null when cost budget excludes every ranked model', () => {
		const result = autoRoute({
			messages: [userMsg('write a poem')],
			availableProviders: ALL_PROVIDERS,
			costBudgetPerMTok: 0.01, // $0.01/Mtok — no model is that cheap
		})
		// Absolute fallback step also respects the budget, so should return null.
		expect(result).toBeNull()
	})

	it('cost budget reason is included in result.reason', () => {
		const result = autoRoute({
			messages: [userMsg('hello there short question?')],
			availableProviders: ALL_PROVIDERS,
			costBudgetPerMTok: 2,
		})
		expect(result?.reason).toContain('≤ $2/Mtok')
	})
})

describe('autoRoute: context-window guard', () => {
	it("demotes models that can't fit large inputs", () => {
		// ~150k tokens of input — most models OK, but Mistral (131k) + Grok (131k)
		// should be filtered out.
		const bigContent = 'x'.repeat(150_000 * 4) // 150k tokens at 4 chars/tok
		const result = autoRoute({
			messages: [userMsg(bigContent)],
			availableProviders: ['mistral', 'xai'],
		})
		// All mistral + xai models have ≤131k context; with 150k + 4k headroom
		// nothing fits → null.
		expect(result).toBeNull()
	})

	it('accepts large inputs on models with enough context', () => {
		const bigContent = 'x'.repeat(150_000 * 4)
		const result = autoRoute({
			messages: [userMsg(bigContent)],
			availableProviders: ['google', 'anthropic'],
		})
		expect(result).not.toBeNull()
		// Must be Gemini Pro/Flash (1M+) or Claude Opus/Sonnet (1M+)
		expect(['google', 'anthropic']).toContain(result?.provider)
	})

	it('short inputs are not filtered by context', () => {
		const result = autoRoute({
			messages: [userMsg('hello')],
			availableProviders: ALL_PROVIDERS,
		})
		expect(result).not.toBeNull()
	})

	it('respects explicit estimatedInputTokens override', () => {
		const result = autoRoute({
			messages: [userMsg('tiny')],
			availableProviders: ['mistral'],
			estimatedInputTokens: 200_000, // lie about token count
		})
		// Mistral models cap at 131k context; 200k + 4k headroom exceeds all → null
		expect(result).toBeNull()
	})
})

describe('autoRoute: preferCheaper / tier="auto"', () => {
	it('tier="auto" picks cheaper of top-3 for general task', () => {
		const result = autoRoute({
			messages: [userMsg('tell me about the weather')],
			availableProviders: ALL_PROVIDERS,
			tier: 'auto',
		})
		expect(result).not.toBeNull()
		expect(result?.reason.toLowerCase()).toContain('auto')
	})

	it('preferCheaper=true with quality tier picks the cheapest of the top-3 quality models', () => {
		// Top-3 of QUALITY_RANKING is Opus, GPT-5.4, Sonnet.
		// Of those, Sonnet is cheapest ($3/$15 = $9 avg), Opus is priciest ($5/$25 = $15).
		// GPT-5.4 is $2.5/$15 = $8.75 — actually cheapest.
		const result = autoRoute({
			messages: [userMsg('solve this hard problem carefully')],
			availableProviders: ALL_PROVIDERS,
			tier: 'quality',
			preferCheaper: true,
		})
		expect(result).not.toBeNull()
		// Result should NOT be Opus (the original #1 and most expensive of the 3)
		expect(result?.modelId).not.toBe('claude-opus-4-6')
	})

	it('without preferCheaper, quality tier still picks #1 ranked (Opus)', () => {
		const result = autoRoute({
			messages: [userMsg('hello')],
			availableProviders: ['anthropic'],
			tier: 'quality',
		})
		expect(result?.modelId).toBe('claude-opus-4-6')
	})
})

describe('autoRoute: composed behavior', () => {
	it('cost budget + context guard + preferCheaper compose correctly', () => {
		// 50k-token input, $2/Mtok budget, prefer cheaper
		const bigContent = 'x'.repeat(50_000 * 4)
		const result = autoRoute({
			messages: [userMsg(bigContent)],
			availableProviders: ALL_PROVIDERS,
			costBudgetPerMTok: 2,
			preferCheaper: true,
		})
		expect(result).not.toBeNull()
		// Cost budget excludes Opus/GPT-5.4; context guard is fine (50k < 128k)
		expect(result?.modelId).not.toBe('claude-opus-4-6')
		expect(result?.modelId).not.toBe('gpt-5.4')
	})
})

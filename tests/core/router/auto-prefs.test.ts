import { autoRoute } from '@edgerouteai/core/router/auto'
import type { ChatMessage } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

function userMsg(content: string): ChatMessage {
	return { role: 'user', content }
}

const ALL = ['openai', 'anthropic', 'google', 'mistral', 'xai']

describe('autoRoute: pinnedProviders', () => {
	it('restricts candidate providers to the pinned set when non-empty', () => {
		const result = autoRoute({
			messages: [userMsg('Help me debug this typescript function')],
			availableProviders: ALL,
			pinnedProviders: ['mistral'],
		})
		expect(result?.provider).toBe('mistral')
	})

	it('treats an empty pin list as no constraint', () => {
		const result = autoRoute({
			messages: [userMsg('Help me debug this typescript function')],
			availableProviders: ALL,
			pinnedProviders: [],
		})
		// Code ranking → first available is anthropic
		expect(result?.provider).toBe('anthropic')
	})

	it('returns null if pin set has no overlap with available providers', () => {
		const result = autoRoute({
			messages: [userMsg('Hello')],
			availableProviders: ['openai'],
			pinnedProviders: ['mistral'],
		})
		expect(result).toBeNull()
	})

	it('intersects pin with available — pinned but unavailable provider is dropped', () => {
		const result = autoRoute({
			messages: [userMsg('Hello')],
			availableProviders: ['openai', 'mistral'],
			pinnedProviders: ['mistral', 'anthropic'],
		})
		expect(result?.provider).toBe('mistral')
	})
})

describe('autoRoute: excludedProviders', () => {
	it('drops the excluded provider even when it would otherwise win', () => {
		// Code ranking ranks anthropic first; excluding it should yield openai.
		const result = autoRoute({
			messages: [userMsg('Help me debug this typescript function')],
			availableProviders: ['anthropic', 'openai'],
			excludedProviders: ['anthropic'],
		})
		expect(result?.provider).toBe('openai')
	})

	it('treats an empty exclude list as no constraint', () => {
		const result = autoRoute({
			messages: [userMsg('Help me debug this typescript function')],
			availableProviders: ['anthropic', 'openai'],
			excludedProviders: [],
		})
		expect(result?.provider).toBe('anthropic')
	})

	it('returns null when all providers are excluded', () => {
		const result = autoRoute({
			messages: [userMsg('Hello')],
			availableProviders: ['openai', 'anthropic'],
			excludedProviders: ['openai', 'anthropic'],
		})
		expect(result).toBeNull()
	})

	it('exclude is applied AFTER pin (intersection then subtract)', () => {
		const result = autoRoute({
			messages: [userMsg('Hello')],
			availableProviders: ['openai', 'anthropic', 'mistral'],
			pinnedProviders: ['anthropic', 'mistral'],
			excludedProviders: ['anthropic'],
		})
		expect(result?.provider).toBe('mistral')
	})
})

describe('autoRoute: maxCostPerRequestCents', () => {
	it('drops candidates whose estimated cost exceeds the cap', () => {
		// Quality tier with a tight cap. All "quality" rankings have output
		// pricing that exceeds 1¢ for a 1000-token reservation; the absolute
		// fallback then picks Gemini Flash which clears the cap.
		const result = autoRoute({
			messages: [userMsg('Hi')],
			availableProviders: ALL,
			tier: 'quality',
			maxCostPerRequestCents: 1,
			outputHeadroomTokens: 1000,
		})
		expect(result).not.toBeNull()
		expect(result?.modelId).not.toBe('claude-opus-4-6')
		expect(result?.modelId).not.toBe('gpt-5.4')
	})

	it('keeps expensive models when the cap is generous', () => {
		const result = autoRoute({
			messages: [userMsg('Tell me a story')],
			availableProviders: ['anthropic', 'openai', 'google'],
			tier: 'quality',
			maxCostPerRequestCents: 1000,
			outputHeadroomTokens: 4096,
		})
		expect(result).not.toBeNull()
		// Quality ranking: anthropic/claude-opus-4-6 first
		expect(result?.modelId).toBe('claude-opus-4-6')
	})

	it('reflects the cap in the reason string when filtering kicks in', () => {
		// At 2¢ cap with 1000-token headroom, claude-opus (≈3¢) is dropped
		// but claude-sonnet (≈2¢) stays — so candidate-set narrowing actually
		// happened and the reason annotation should fire.
		const result = autoRoute({
			messages: [userMsg('Hi')],
			availableProviders: ['anthropic'],
			tier: 'quality',
			maxCostPerRequestCents: 2,
			outputHeadroomTokens: 1000,
		})
		expect(result?.reason).toContain('¢/request')
	})
})

describe('autoRoute: prefs combined', () => {
	it('pin + exclude + per-request cap compose correctly', () => {
		const result = autoRoute({
			messages: [userMsg('Hi')],
			availableProviders: ALL,
			pinnedProviders: ['google', 'mistral'],
			excludedProviders: ['google'],
			tier: 'quality',
			maxCostPerRequestCents: 100,
			outputHeadroomTokens: 4096,
		})
		// Only mistral remains after pin∩available − exclude.
		expect(result?.provider).toBe('mistral')
	})

	it('falls back through to absolute fallback while still respecting pin', () => {
		// Force ranking miss by pinning a single provider whose model isn't
		// on the matched ranking. Absolute fallback should still pick from it.
		const result = autoRoute({
			messages: [userMsg('Write a javascript function to sort an array')],
			availableProviders: ['mistral'],
			pinnedProviders: ['mistral'],
		})
		expect(result?.provider).toBe('mistral')
		expect(result?.reason).toContain('Fallback to mistral')
	})
})

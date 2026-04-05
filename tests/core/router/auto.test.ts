import { autoRoute } from '@edgerouteai/core/router/auto'
import type { ChatMessage } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

function userMsg(content: string): ChatMessage {
	return { role: 'user', content }
}

describe('autoRoute', () => {
	describe('available providers filtering', () => {
		it('only picks models from available providers', () => {
			const result = autoRoute({
				messages: [userMsg('Hello, how are you?')],
				availableProviders: ['anthropic'],
			})
			expect(result).not.toBeNull()
			expect(result?.provider).toBe('anthropic')
		})

		it('returns null when no available providers match any model', () => {
			const result = autoRoute({
				messages: [userMsg('Hello')],
				availableProviders: [],
			})
			expect(result).toBeNull()
		})

		it('picks from multiple available providers', () => {
			const result = autoRoute({
				messages: [userMsg('What is 2+2?')],
				availableProviders: ['openai', 'anthropic'],
			})
			expect(result).not.toBeNull()
			expect(['openai', 'anthropic']).toContain(result?.provider)
		})
	})

	describe('quality tier', () => {
		it('picks anthropic claude-sonnet-4-6 first when anthropic is available', () => {
			const result = autoRoute({
				messages: [userMsg('Write me a detailed analysis')],
				availableProviders: ['anthropic', 'openai', 'google'],
				tier: 'quality',
			})
			expect(result).not.toBeNull()
			expect(result?.provider).toBe('anthropic')
			expect(result?.modelId).toBe('claude-opus-4-6')
		})

		it('picks openai gpt-5.4 when anthropic not available (quality tier)', () => {
			const result = autoRoute({
				messages: [userMsg('Write me a detailed analysis')],
				availableProviders: ['openai'],
				tier: 'quality',
			})
			expect(result).not.toBeNull()
			expect(result?.provider).toBe('openai')
			expect(result?.modelId).toBe('gpt-5.4')
		})

		it('includes quality reason in result', () => {
			const result = autoRoute({
				messages: [userMsg('Analyze this deeply')],
				availableProviders: ['anthropic'],
				tier: 'quality',
			})
			expect(result?.reason).toContain('Quality tier requested')
		})
	})

	describe('budget tier', () => {
		it('picks gemini flash first when google is available', () => {
			const result = autoRoute({
				messages: [userMsg('What is the capital of France?')],
				availableProviders: ['google', 'openai', 'anthropic'],
				tier: 'budget',
			})
			expect(result).not.toBeNull()
			expect(result?.provider).toBe('google')
			expect(result?.modelId).toBe('gemini-2.5-flash-lite')
		})

		it('picks claude haiku when google not available (budget tier)', () => {
			const result = autoRoute({
				messages: [userMsg('Quick question')],
				availableProviders: ['anthropic'],
				tier: 'budget',
			})
			expect(result).not.toBeNull()
			expect(result?.provider).toBe('anthropic')
			expect(result?.modelId).toBe('claude-haiku-4-5')
		})

		it('includes budget reason in result', () => {
			const result = autoRoute({
				messages: [userMsg('What is the capital of France?')],
				availableProviders: ['google'],
				tier: 'budget',
			})
			expect(result?.reason).toContain('Budget tier requested')
		})
	})

	describe('task detection', () => {
		it('detects code tasks and uses code ranking', () => {
			const result = autoRoute({
				messages: [userMsg('Help me debug this TypeScript function')],
				availableProviders: ['anthropic', 'openai'],
			})
			expect(result).not.toBeNull()
			// Code ranking prefers anthropic/claude-sonnet-4-6 first
			expect(result?.provider).toBe('anthropic')
			expect(result?.reason).toContain('Detected coding task')
		})

		it('detects creative tasks and uses quality models', () => {
			const result = autoRoute({
				messages: [userMsg('Write me a short story about a robot')],
				availableProviders: ['anthropic', 'openai'],
			})
			expect(result).not.toBeNull()
			expect(result?.reason).toContain('Detected creative task')
		})

		it('detects simple questions and uses budget models', () => {
			const result = autoRoute({
				messages: [userMsg('What time is it?')],
				availableProviders: ['google', 'openai', 'anthropic'],
			})
			expect(result).not.toBeNull()
			expect(result?.reason).toContain('Simple query detected')
		})

		it('uses balanced tier for general complex queries', () => {
			const result = autoRoute({
				messages: [
					userMsg(
						'I need a thorough explanation of how quantum entanglement works in modern physics research',
					),
				],
				availableProviders: ['openai'],
			})
			expect(result).not.toBeNull()
			expect(result?.reason).toContain('balanced')
		})

		it('detects python as a code keyword', () => {
			const result = autoRoute({
				messages: [userMsg('How do I sort a list in python?')],
				availableProviders: ['anthropic'],
			})
			expect(result?.reason).toContain('Detected coding task')
		})

		it('detects poem as creative keyword', () => {
			const result = autoRoute({
				messages: [userMsg('Write me a poem about the ocean')],
				availableProviders: ['anthropic'],
			})
			expect(result?.reason).toContain('Detected creative task')
		})
	})

	describe('fallback when preferred provider unavailable', () => {
		it('falls back to next provider in ranking when first not available', () => {
			// Quality ranking: anthropic → openai → google → ...
			// If only openai is available, should pick openai/gpt-4.1
			const result = autoRoute({
				messages: [userMsg('Help me with this complex analysis task that requires deep thinking')],
				availableProviders: ['openai'],
				tier: 'quality',
			})
			expect(result).not.toBeNull()
			expect(result?.provider).toBe('openai')
		})

		it('uses absolute fallback when none of the ranked models match', () => {
			// mistral is not in CODE_RANKING, should use the absolute fallback
			const result = autoRoute({
				messages: [userMsg('Write a javascript function to sort an array')],
				availableProviders: ['mistral'],
			})
			expect(result).not.toBeNull()
			expect(result?.provider).toBe('mistral')
			expect(result?.reason).toContain('Fallback to mistral')
		})
	})

	describe('tier overrides task detection', () => {
		it('budget tier overrides code detection', () => {
			const result = autoRoute({
				messages: [userMsg('Fix this TypeScript error in my code')],
				availableProviders: ['google'],
				tier: 'budget',
			})
			expect(result).not.toBeNull()
			// Budget tier should pick gemini flash, not code-optimized model
			expect(result?.reason).toContain('Budget tier requested')
		})

		it('quality tier overrides simple query detection', () => {
			const result = autoRoute({
				messages: [userMsg('Why?')],
				availableProviders: ['anthropic'],
				tier: 'quality',
			})
			expect(result).not.toBeNull()
			expect(result?.reason).toContain('Quality tier requested')
		})
	})
})

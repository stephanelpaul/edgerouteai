import { autoRoute } from '@edgerouteai/core/router/auto'
import type { ChatMessage } from '@edgerouteai/shared'
import { describe, expect, it } from 'vitest'

function userMsg(content: string): ChatMessage {
	return { role: 'user', content }
}

describe('autoRoute: taskTypeOverride', () => {
	it('uses code ranking when override is "code", even for a non-code prompt', () => {
		const result = autoRoute({
			messages: [userMsg('Tell me about the weather today.')],
			availableProviders: ['anthropic', 'openai'],
			taskTypeOverride: 'code',
		})
		expect(result).not.toBeNull()
		// Code ranking starts with anthropic/claude-sonnet-4-6
		expect(result?.provider).toBe('anthropic')
		expect(result?.modelId).toBe('claude-sonnet-4-6')
	})

	it('emits a "Classified" reason (not "Detected") when override is set', () => {
		const result = autoRoute({
			messages: [userMsg('Tell me about the weather today.')],
			availableProviders: ['anthropic'],
			taskTypeOverride: 'code',
		})
		expect(result?.reason).toContain('Classified coding task')
		expect(result?.reason).not.toContain('Detected coding task')
	})

	it('uses creative ranking on override even when keyword scan would say general', () => {
		const result = autoRoute({
			messages: [userMsg('Tell me about the weather today.')],
			availableProviders: ['anthropic'],
			taskTypeOverride: 'creative',
		})
		expect(result?.reason).toContain('Classified creative task')
	})

	it('falls back to keyword detection when override is undefined', () => {
		const result = autoRoute({
			messages: [userMsg('Help me debug this typescript function')],
			availableProviders: ['anthropic'],
		})
		expect(result?.reason).toContain('Detected coding task')
	})

	it('explicit tier still overrides taskTypeOverride', () => {
		const result = autoRoute({
			messages: [userMsg('hello')],
			availableProviders: ['anthropic'],
			tier: 'quality',
			taskTypeOverride: 'code',
		})
		expect(result?.reason).toContain('Quality tier requested')
	})

	it('auto tier with classified code lower-cases the verb in the reason', () => {
		const result = autoRoute({
			messages: [userMsg('hello')],
			availableProviders: ['anthropic'],
			tier: 'auto',
			taskTypeOverride: 'code',
		})
		expect(result?.reason).toContain('classified coding task')
	})
})

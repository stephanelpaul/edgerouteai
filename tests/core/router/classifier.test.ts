import {
	buildClassifierPrompt,
	classifyTaskType,
	detectTaskTypeKeyword,
	lastUserText,
	parseClassification,
} from '@edgerouteai/core/router/classifier'
import type { ChatMessage } from '@edgerouteai/shared'
import { describe, expect, it, vi } from 'vitest'

function userMsg(content: string): ChatMessage {
	return { role: 'user', content }
}

describe('classifier (keyword)', () => {
	it('returns "code" for programming-flavored prompts', () => {
		expect(detectTaskTypeKeyword([userMsg('Help me debug this TypeScript function')])).toBe('code')
	})

	it('returns "creative" for narrative prompts', () => {
		expect(detectTaskTypeKeyword([userMsg('Write me a poem about the ocean')])).toBe('creative')
	})

	it('returns "general" when no keywords match', () => {
		expect(detectTaskTypeKeyword([userMsg('Why is the sky blue?')])).toBe('general')
	})

	it('returns "general" on empty transcript', () => {
		expect(detectTaskTypeKeyword([])).toBe('general')
	})

	it('reads only the last user message', () => {
		const msgs: ChatMessage[] = [
			userMsg('Write me a story'),
			{ role: 'assistant', content: 'sure' },
			userMsg('Now show me python code'),
		]
		expect(detectTaskTypeKeyword(msgs)).toBe('code')
	})
})

describe('parseClassification', () => {
	it('parses a single-word verdict', () => {
		expect(parseClassification('code')).toBe('code')
		expect(parseClassification('creative')).toBe('creative')
		expect(parseClassification('general')).toBe('general')
	})

	it('parses verdicts inside punctuation/whitespace', () => {
		expect(parseClassification(' code.')).toBe('code')
		expect(parseClassification('Answer: creative\n')).toBe('creative')
	})

	it('does not match substrings', () => {
		expect(parseClassification('encoded message')).toBe(null)
		expect(parseClassification('generality')).toBe(null)
	})

	it('returns null when no verdict found', () => {
		expect(parseClassification('I am not sure')).toBe(null)
	})

	it('is case-insensitive', () => {
		expect(parseClassification('CODE')).toBe('code')
		expect(parseClassification('Creative')).toBe('creative')
	})
})

describe('buildClassifierPrompt', () => {
	it('embeds the user content', () => {
		const prompt = buildClassifierPrompt('Refactor this paragraph')
		expect(prompt).toContain('Refactor this paragraph')
		expect(prompt).toContain('one word')
		expect(prompt).toContain('Answer:')
	})
})

describe('classifyTaskType (LLM)', () => {
	it('returns the LLM verdict on success', async () => {
		const callModel = vi.fn().mockResolvedValue('creative')
		const verdict = await classifyTaskType({
			messages: [userMsg('Refactor this paragraph')],
			callModel,
		})
		expect(verdict).toBe('creative')
		expect(callModel).toHaveBeenCalledOnce()
	})

	it('falls back to keyword detection when callModel throws', async () => {
		const callModel = vi.fn().mockRejectedValue(new Error('network down'))
		const verdict = await classifyTaskType({
			messages: [userMsg('Help me debug this code')],
			callModel,
		})
		expect(verdict).toBe('code')
	})

	it('falls back to keyword detection on unparseable response', async () => {
		const callModel = vi.fn().mockResolvedValue('I am not sure honestly')
		const verdict = await classifyTaskType({
			messages: [userMsg('Help me debug this code')],
			callModel,
		})
		expect(verdict).toBe('code')
	})

	it('returns "general" for empty user content without calling model', async () => {
		const callModel = vi.fn()
		const verdict = await classifyTaskType({
			messages: [{ role: 'assistant', content: 'hi' }],
			callModel,
		})
		expect(verdict).toBe('general')
		expect(callModel).not.toHaveBeenCalled()
	})

	it('truncates very long content before calling the model', async () => {
		const long = 'x'.repeat(5000)
		const callModel = vi.fn(async (prompt: string) => {
			expect(prompt.length).toBeLessThan(2000)
			return 'general'
		})
		await classifyTaskType({
			messages: [userMsg(long)],
			callModel,
			maxContentChars: 200,
		})
		expect(callModel).toHaveBeenCalledOnce()
	})

	it('aborts the call on timeout and falls back to keyword', async () => {
		const callModel = vi.fn(
			(_prompt: string, signal?: AbortSignal) =>
				new Promise<string>((_resolve, reject) => {
					if (signal) {
						signal.addEventListener('abort', () => reject(new Error('aborted')))
					}
				}),
		)
		const verdict = await classifyTaskType({
			messages: [userMsg('Write a short story')],
			callModel,
			timeoutMs: 30,
		})
		expect(verdict).toBe('creative')
	})
})

describe('lastUserText', () => {
	it('returns the last user message text', () => {
		expect(lastUserText([userMsg('hi'), userMsg('bye')])).toBe('bye')
	})

	it('returns empty string for non-string content', () => {
		const msgs: ChatMessage[] = [
			{ role: 'user', content: [{ type: 'text', text: 'multi-modal' }] as unknown as string },
		]
		expect(lastUserText(msgs)).toBe('')
	})

	it('returns empty string when there is no user turn', () => {
		expect(lastUserText([{ role: 'assistant', content: 'hello' }])).toBe('')
	})
})

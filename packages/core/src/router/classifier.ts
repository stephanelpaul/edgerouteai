// LLM-backed task classifier for the smart router.
//
// The auto-router needs to decide whether a request is a coding task, a
// creative-writing task, or a general query so it can pick the right model
// ranking. A keyword scan (see `detectTaskTypeKeyword`) is fast and free but
// brittle — "Refactor this paragraph" looks like a code task to a keyword
// matcher. This module adds an opt-in LLM-backed classifier that calls a
// cheap model (Haiku / Flash-Lite) and falls back to the keyword scan on any
// failure (timeout, parse error, network).
//
// The module is pure: it takes a `callModel` callback and returns a verdict.
// The gateway (apps/api) wires the callback to the actual provider request
// and handles KV caching of classifications. This keeps the package free of
// I/O and trivial to unit-test.
import type { ChatMessage } from '@edgerouteai/shared'

export type TaskType = 'code' | 'creative' | 'general'

const CODE_KEYWORDS = [
	'code',
	'function',
	'debug',
	'error',
	'implement',
	'programming',
	'typescript',
	'python',
	'javascript',
	'api',
	'bug',
	'fix',
	'refactor',
	'class',
	'interface',
	'component',
	'react',
	'sql',
	'query',
	'algorithm',
] as const

const CREATIVE_KEYWORDS = [
	'write',
	'story',
	'poem',
	'creative',
	'essay',
	'blog',
	'article',
	'draft',
	'compose',
	'narrative',
] as const

/** Pull the most recent user message text out of a transcript. Empty if none. */
export function lastUserText(messages: ChatMessage[]): string {
	const last = [...messages].reverse().find((m) => m.role === 'user')
	if (!last) return ''
	return typeof last.content === 'string' ? last.content : ''
}

/** Cheap, free, and available offline. Always returns a verdict. */
export function detectTaskTypeKeyword(messages: ChatMessage[]): TaskType {
	const content = lastUserText(messages).toLowerCase()
	if (!content) return 'general'
	if (CODE_KEYWORDS.some((kw) => content.includes(kw))) return 'code'
	if (CREATIVE_KEYWORDS.some((kw) => content.includes(kw))) return 'creative'
	return 'general'
}

export interface ClassifyOptions {
	messages: ChatMessage[]
	/**
	 * Caller-supplied LLM invocation. Must return the model's reply as plain
	 * text. The classifier sends a tightly-scoped prompt and parses one word
	 * out of the response, so the caller can use any chat-completion API.
	 */
	callModel: (prompt: string, signal?: AbortSignal) => Promise<string>
	/** Hard ceiling on classifier latency. Default 1500ms. */
	timeoutMs?: number
	/** Maximum chars of user content sent to the classifier. Default 500. */
	maxContentChars?: number
}

const DEFAULT_TIMEOUT_MS = 1500
const DEFAULT_MAX_CONTENT_CHARS = 500

/**
 * Classify a request via an LLM call. Falls back to keyword detection on any
 * error, timeout, or unparseable response — never throws. Total latency is
 * bounded by `timeoutMs`.
 */
export async function classifyTaskType(opts: ClassifyOptions): Promise<TaskType> {
	const content = lastUserText(opts.messages).trim()
	if (!content) return 'general'

	const maxChars = opts.maxContentChars ?? DEFAULT_MAX_CONTENT_CHARS
	const truncated = content.length > maxChars ? content.slice(0, maxChars) : content
	const prompt = buildClassifierPrompt(truncated)

	const controller = new AbortController()
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
	const timer = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const raw = await opts.callModel(prompt, controller.signal)
		const parsed = parseClassification(raw)
		if (parsed) return parsed
		return detectTaskTypeKeyword(opts.messages)
	} catch {
		return detectTaskTypeKeyword(opts.messages)
	} finally {
		clearTimeout(timer)
	}
}

/** Internal: the one-shot prompt sent to the classifier model. */
export function buildClassifierPrompt(userContent: string): string {
	return [
		'Classify the user request as exactly one word: code, creative, or general.',
		'- code: programming, debugging, technical implementation, code review',
		'- creative: stories, poems, marketing copy, narrative writing',
		'- general: everything else (questions, analysis, conversation)',
		'Respond with one word only — no punctuation, no explanation.',
		'',
		`Request: ${userContent}`,
		'Answer:',
	].join('\n')
}

/** Internal: best-effort parser. Returns null if no verdict found. */
export function parseClassification(raw: string): TaskType | null {
	const lower = raw.toLowerCase()
	// Check `code` first because it could appear inside other words; we rely
	// on word-boundary regex below to avoid matching "encoded" → "code".
	const matches: Array<[TaskType, RegExp]> = [
		['code', /\bcode\b/],
		['creative', /\bcreative\b/],
		['general', /\bgeneral\b/],
	]
	for (const [verdict, re] of matches) {
		if (re.test(lower)) return verdict
	}
	return null
}

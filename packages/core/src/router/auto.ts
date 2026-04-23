import {
	type ChatMessage,
	avgCostPerMTok,
	estimateTokens,
	getContextLength,
} from '@edgerouteai/shared'
import { type ResolvedRoute, resolveRoute } from './resolver.js'

export type CostTier = 'quality' | 'balanced' | 'budget' | 'auto'

export interface AutoRouteOptions {
	messages: ChatMessage[]
	availableProviders: string[]
	tier?: CostTier
	/**
	 * Cap on average $/M tokens ((input + output) / 2). Models above this are
	 * filtered out before provider-availability is checked. Useful for
	 * budget-conscious agents.
	 */
	costBudgetPerMTok?: number
	/**
	 * When true, sort the candidate ranking by cost ascending within the top-3
	 * of the matching tier, rather than strict ranking order. Favors cheaper
	 * models without dropping quality off a cliff.
	 *
	 * `tier: "auto"` implies this.
	 */
	preferCheaper?: boolean
	/**
	 * Override the estimated input-token count used for the context-window
	 * guard. Defaults to estimating from `messages`. Set explicitly if the
	 * caller wants to reserve headroom for the output.
	 */
	estimatedInputTokens?: number
	/**
	 * Additional output-token headroom to reserve above the input when
	 * checking context fit. Default: 4096 tokens.
	 */
	outputHeadroomTokens?: number
}

export interface AutoRouteResult extends ResolvedRoute {
	reason: string
}

const QUALITY_RANKING = [
	'anthropic/claude-opus-4-6',
	'openai/gpt-5.4',
	'anthropic/claude-sonnet-4-6',
	'openai/gpt-5.2',
	'google/gemini-2.5-pro-preview-03-25',
	'openai/gpt-5',
	'openai/gpt-4o',
	'xai/grok-4.20',
	'mistral/mistral-large-latest',
]

const BALANCED_RANKING = [
	'openai/gpt-5',
	'anthropic/claude-sonnet-4-6',
	'openai/gpt-4o',
	'google/gemini-2.5-pro-preview-03-25',
	'xai/grok-4.20',
	'mistral/mistral-large-latest',
	'openai/gpt-5.4-mini',
	'google/gemini-2.5-flash-preview-04-17',
]

const BUDGET_RANKING = [
	'google/gemini-2.5-flash-lite',
	'google/gemini-2.5-flash-preview-04-17',
	'mistral/mistral-small-latest',
	'openai/gpt-5.4-mini',
	'anthropic/claude-haiku-4-5',
	'openai/o4-mini',
	'mistral/mistral-medium-latest',
]

const CODE_RANKING = [
	'anthropic/claude-sonnet-4-6',
	'openai/gpt-5.4',
	'openai/gpt-5.2',
	'openai/gpt-4.1',
	'anthropic/claude-opus-4-6',
	'google/gemini-2.5-pro-preview-03-25',
	'openai/gpt-4o',
	'xai/grok-4.20',
]

function detectTaskType(messages: ChatMessage[]): 'code' | 'creative' | 'general' {
	const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
	if (!lastUserMsg) return 'general'

	const content = typeof lastUserMsg.content === 'string' ? lastUserMsg.content.toLowerCase() : ''

	const codeKeywords = [
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
	]
	const creativeKeywords = [
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
	]

	if (codeKeywords.some((kw) => content.includes(kw))) return 'code'
	if (creativeKeywords.some((kw) => content.includes(kw))) return 'creative'
	return 'general'
}

function detectComplexity(messages: ChatMessage[]): 'simple' | 'complex' {
	const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
	if (!lastUserMsg) return 'complex'
	const content = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : ''
	// Short messages with a question mark = simple
	if (content.length < 80 && content.includes('?')) return 'simple'
	// Very short messages = simple
	if (content.length < 30) return 'simple'
	return 'complex'
}

export function autoRoute(options: AutoRouteOptions): AutoRouteResult | null {
	const {
		messages,
		availableProviders,
		tier,
		costBudgetPerMTok,
		preferCheaper,
		estimatedInputTokens,
		outputHeadroomTokens = 4096,
	} = options

	const taskType = detectTaskType(messages)
	const complexity = detectComplexity(messages)

	// Pick the ranking based on task type and tier
	// Explicit tier always overrides task detection, EXCEPT "auto" which still
	// does task detection but applies cost-preferring sort.
	let ranking: string[]
	let reason: string

	if (tier === 'quality') {
		ranking = QUALITY_RANKING
		reason = 'Quality tier requested'
	} else if (tier === 'budget') {
		ranking = BUDGET_RANKING
		reason = 'Budget tier requested'
	} else if (tier === 'balanced') {
		ranking = BALANCED_RANKING
		reason = 'Using balanced tier'
	} else if (tier === 'auto') {
		// auto = task-aware + cost-preferring. Picks from the matching category
		// but prefers the cheapest model that clears the quality bar.
		if (taskType === 'code') {
			ranking = CODE_RANKING
			reason = 'Auto: detected coding task, cost-preferring'
		} else if (taskType === 'creative') {
			ranking = QUALITY_RANKING
			reason = 'Auto: detected creative task, cost-preferring'
		} else if (complexity === 'simple') {
			ranking = BUDGET_RANKING
			reason = 'Auto: simple query, cost-preferring'
		} else {
			ranking = BALANCED_RANKING
			reason = 'Auto: balanced default, cost-preferring'
		}
	} else if (taskType === 'code') {
		ranking = CODE_RANKING
		reason = 'Detected coding task'
	} else if (taskType === 'creative') {
		ranking = QUALITY_RANKING
		reason = 'Detected creative task, using quality models'
	} else if (complexity === 'simple') {
		ranking = BUDGET_RANKING
		reason = 'Simple query detected, using budget models'
	} else {
		ranking = BALANCED_RANKING
		reason = 'Using balanced tier'
	}

	const effectivePreferCheaper = preferCheaper || tier === 'auto'

	// 1) Cost-budget filter (if set).
	let candidates = ranking
	if (costBudgetPerMTok !== undefined) {
		const before = candidates.length
		candidates = candidates.filter((m) => avgCostPerMTok(m) <= costBudgetPerMTok)
		if (candidates.length < before) {
			reason = `${reason}, filtered to ≤ $${costBudgetPerMTok}/Mtok`
		}
	}

	// 2) Context-window guard: reject models that can't hold the estimated
	//    input + output headroom.
	const tokens =
		estimatedInputTokens ?? estimateTokens(messages as Array<{ content: string | unknown }>)
	const needContext = tokens + outputHeadroomTokens
	if (needContext > 0) {
		const contextFiltered = candidates.filter((m) => {
			const ctx = getContextLength(m)
			return ctx === undefined ? true : ctx >= needContext
		})
		if (contextFiltered.length < candidates.length) {
			reason = `${reason}, filtered to ≥${Math.ceil(needContext / 1000)}k context`
			candidates = contextFiltered
		}
	}

	// 3) preferCheaper / auto: sort the top-3 of the filtered ranking by cost
	//    ascending. Keeps only strong models but picks the cheapest among them.
	if (effectivePreferCheaper && candidates.length > 1) {
		const top3 = candidates.slice(0, 3)
		const rest = candidates.slice(3)
		top3.sort((a, b) => avgCostPerMTok(a) - avgCostPerMTok(b))
		candidates = [...top3, ...rest]
	}

	// 4) First candidate whose provider the user has access to wins.
	for (const modelString of candidates) {
		const route = resolveRoute(modelString)
		if (route && availableProviders.includes(route.provider)) {
			return {
				...route,
				reason: `${reason} → ${modelString}`,
			}
		}
	}

	// 5) Absolute fallback: any model from any available provider that still
	//    satisfies the cost budget AND the context-fit constraint. Returning a
	//    model that exceeds either constraint would defeat the caller's intent.
	for (const provider of availableProviders) {
		const fallbacks: Record<string, string> = {
			openai: 'openai/gpt-5',
			anthropic: 'anthropic/claude-sonnet-4-6',
			google: 'google/gemini-2.5-flash-preview-04-17',
			mistral: 'mistral/mistral-large-latest',
			xai: 'xai/grok-4.20',
		}
		const model = fallbacks[provider]
		if (!model) continue
		if (costBudgetPerMTok !== undefined && avgCostPerMTok(model) > costBudgetPerMTok) continue
		const ctx = getContextLength(model)
		if (ctx !== undefined && ctx < needContext) continue
		const route = resolveRoute(model)
		if (route) return { ...route, reason: `Fallback to ${provider}` }
	}

	return null
}

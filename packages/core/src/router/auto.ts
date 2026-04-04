import type { ChatMessage } from '@edgerouteai/shared'
import { resolveRoute, type ResolvedRoute } from './resolver.js'

export type CostTier = 'quality' | 'balanced' | 'budget'

export interface AutoRouteOptions {
  messages: ChatMessage[]
  availableProviders: string[]
  tier?: CostTier
}

export interface AutoRouteResult extends ResolvedRoute {
  reason: string
}

const QUALITY_RANKING = [
  'anthropic/claude-sonnet-4-6',
  'openai/gpt-4.1',
  'google/gemini-2.5-pro-preview-03-25',
  'openai/gpt-4o',
  'xai/grok-4.20',
  'mistral/mistral-large-latest',
]

const BALANCED_RANKING = [
  'openai/gpt-4o',
  'anthropic/claude-sonnet-4-6',
  'google/gemini-2.5-pro-preview-03-25',
  'xai/grok-4.20',
  'mistral/mistral-large-latest',
  'google/gemini-2.5-flash-preview-04-17',
]

const BUDGET_RANKING = [
  'google/gemini-2.5-flash-preview-04-17',
  'anthropic/claude-haiku-4-5',
  'openai/o4-mini',
  'mistral/mistral-medium-latest',
  'openai/gpt-4o',
]

const CODE_RANKING = [
  'anthropic/claude-sonnet-4-6',
  'openai/gpt-4.1',
  'openai/gpt-4o',
  'google/gemini-2.5-pro-preview-03-25',
  'xai/grok-4.20',
]

function detectTaskType(messages: ChatMessage[]): 'code' | 'creative' | 'general' {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUserMsg) return 'general'

  const content =
    typeof lastUserMsg.content === 'string' ? lastUserMsg.content.toLowerCase() : ''

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
  const content =
    typeof lastUserMsg.content === 'string' ? lastUserMsg.content : ''
  // Short messages with a question mark = simple
  if (content.length < 80 && content.includes('?')) return 'simple'
  // Very short messages = simple
  if (content.length < 30) return 'simple'
  return 'complex'
}

export function autoRoute(options: AutoRouteOptions): AutoRouteResult | null {
  const { messages, availableProviders, tier } = options

  const taskType = detectTaskType(messages)
  const complexity = detectComplexity(messages)

  // Pick the ranking based on task type and tier
  // Explicit tier always overrides task detection
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

  // Find first model where user has the provider key
  for (const modelString of ranking) {
    const route = resolveRoute(modelString)
    if (route && availableProviders.includes(route.provider)) {
      return {
        ...route,
        reason: `${reason} → ${modelString}`,
      }
    }
  }

  // Absolute fallback: try any model from any available provider
  for (const provider of availableProviders) {
    const fallbacks: Record<string, string> = {
      openai: 'openai/gpt-4o',
      anthropic: 'anthropic/claude-sonnet-4-6',
      google: 'google/gemini-2.5-flash-preview-04-17',
      mistral: 'mistral/mistral-large-latest',
      xai: 'xai/grok-4.20',
    }
    const model = fallbacks[provider]
    if (model) {
      const route = resolveRoute(model)
      if (route) return { ...route, reason: `Fallback to ${provider}` }
    }
  }

  return null
}

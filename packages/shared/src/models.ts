export interface ModelConfig {
	id: string
	provider: string
	name: string
	contextLength: number
}

export const MODELS: Record<string, ModelConfig> = {
	// OpenAI
	'openai/gpt-5.4': { id: 'gpt-5.4', provider: 'openai', name: 'GPT-5.4', contextLength: 1047576 },
	'openai/gpt-5.4-mini': {
		id: 'gpt-5.4-mini',
		provider: 'openai',
		name: 'GPT-5.4 Mini',
		contextLength: 1047576,
	},
	'openai/gpt-5.2': { id: 'gpt-5.2', provider: 'openai', name: 'GPT-5.2', contextLength: 1047576 },
	'openai/gpt-5': { id: 'gpt-5', provider: 'openai', name: 'GPT-5', contextLength: 1047576 },
	'openai/gpt-4o': { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', contextLength: 128000 },
	'openai/gpt-4.1': { id: 'gpt-4.1', provider: 'openai', name: 'GPT-4.1', contextLength: 1047576 },
	'openai/o3': { id: 'o3', provider: 'openai', name: 'o3', contextLength: 200000 },
	'openai/o4-mini': { id: 'o4-mini', provider: 'openai', name: 'o4-mini', contextLength: 200000 },
	// Anthropic
	'anthropic/claude-opus-4-6': {
		id: 'claude-opus-4-6',
		provider: 'anthropic',
		name: 'Claude Opus 4.6',
		contextLength: 1000000,
	},
	'anthropic/claude-sonnet-4-6': {
		id: 'claude-sonnet-4-6',
		provider: 'anthropic',
		name: 'Claude Sonnet 4.6',
		contextLength: 1000000,
	},
	'anthropic/claude-sonnet-4-5': {
		id: 'claude-sonnet-4-5',
		provider: 'anthropic',
		name: 'Claude Sonnet 4.5',
		contextLength: 200000,
	},
	'anthropic/claude-haiku-4-5': {
		id: 'claude-haiku-4-5',
		provider: 'anthropic',
		name: 'Claude Haiku 4.5',
		contextLength: 200000,
	},
	// Google
	'google/gemini-2.5-pro': {
		id: 'gemini-2.5-pro-preview-03-25',
		provider: 'google',
		name: 'Gemini 2.5 Pro',
		contextLength: 1048576,
	},
	'google/gemini-2.5-flash': {
		id: 'gemini-2.5-flash-preview-04-17',
		provider: 'google',
		name: 'Gemini 2.5 Flash',
		contextLength: 1048576,
	},
	'google/gemini-2.5-flash-lite': {
		id: 'gemini-2.5-flash-lite',
		provider: 'google',
		name: 'Gemini 2.5 Flash Lite',
		contextLength: 1048576,
	},
	// Mistral
	'mistral/mistral-large': {
		id: 'mistral-large-latest',
		provider: 'mistral',
		name: 'Mistral Large 3',
		contextLength: 131072,
	},
	'mistral/mistral-medium': {
		id: 'mistral-medium-latest',
		provider: 'mistral',
		name: 'Mistral Medium 3',
		contextLength: 131072,
	},
	'mistral/mistral-small': {
		id: 'mistral-small-latest',
		provider: 'mistral',
		name: 'Mistral Small 3.1',
		contextLength: 131072,
	},
	// xAI
	'xai/grok-4.20': { id: 'grok-4.20', provider: 'xai', name: 'Grok 4.20', contextLength: 131072 },
	// Groq — free-tier-friendly, absurdly fast inference on open-weight models.
	'groq/llama-3.3-70b-versatile': {
		id: 'llama-3.3-70b-versatile',
		provider: 'groq',
		name: 'Llama 3.3 70B (Groq)',
		contextLength: 128000,
	},
	'groq/llama-3.1-8b-instant': {
		id: 'llama-3.1-8b-instant',
		provider: 'groq',
		name: 'Llama 3.1 8B Instant (Groq)',
		contextLength: 128000,
	},
	'groq/deepseek-r1-distill-llama-70b': {
		id: 'deepseek-r1-distill-llama-70b',
		provider: 'groq',
		name: 'DeepSeek R1 Distill Llama 70B (Groq)',
		contextLength: 128000,
	},
	'groq/qwen-2.5-coder-32b': {
		id: 'qwen-2.5-coder-32b',
		provider: 'groq',
		name: 'Qwen 2.5 Coder 32B (Groq)',
		contextLength: 128000,
	},
	'groq/mixtral-8x7b-32768': {
		id: 'mixtral-8x7b-32768',
		provider: 'groq',
		name: 'Mixtral 8x7B (Groq)',
		contextLength: 32768,
	},
	// Together AI — inference-for-rent across the open-weight catalog.
	'together/llama-3.3-70b': {
		id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
		provider: 'together',
		name: 'Llama 3.3 70B Turbo (Together)',
		contextLength: 131072,
	},
	'together/llama-3.1-8b': {
		id: 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
		provider: 'together',
		name: 'Llama 3.1 8B Turbo (Together)',
		contextLength: 131072,
	},
	'together/qwen-2.5-72b': {
		id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
		provider: 'together',
		name: 'Qwen 2.5 72B (Together)',
		contextLength: 131072,
	},
	'together/qwen-2.5-coder-32b': {
		id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
		provider: 'together',
		name: 'Qwen 2.5 Coder 32B (Together)',
		contextLength: 131072,
	},
	'together/deepseek-v3': {
		id: 'deepseek-ai/DeepSeek-V3',
		provider: 'together',
		name: 'DeepSeek V3 (Together)',
		contextLength: 131072,
	},
	'together/deepseek-r1': {
		id: 'deepseek-ai/DeepSeek-R1',
		provider: 'together',
		name: 'DeepSeek R1 (Together)',
		contextLength: 131072,
	},
	// Cloudflare Workers AI — zero egress for Cloudflare tenants.
	'cloudflare/llama-3.3-70b': {
		id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
		provider: 'cloudflare',
		name: 'Llama 3.3 70B (Cloudflare)',
		contextLength: 24000,
	},
	'cloudflare/llama-3.1-8b': {
		id: '@cf/meta/llama-3.1-8b-instruct',
		provider: 'cloudflare',
		name: 'Llama 3.1 8B (Cloudflare)',
		contextLength: 128000,
	},
	'cloudflare/llama-3.2-3b': {
		id: '@cf/meta/llama-3.2-3b-instruct',
		provider: 'cloudflare',
		name: 'Llama 3.2 3B (Cloudflare)',
		contextLength: 128000,
	},
	'cloudflare/mistral-small': {
		id: '@cf/mistral/mistral-small-3.1-24b-instruct',
		provider: 'cloudflare',
		name: 'Mistral Small 3.1 24B (Cloudflare)',
		contextLength: 128000,
	},
	'cloudflare/deepseek-r1-distill': {
		id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
		provider: 'cloudflare',
		name: 'DeepSeek R1 Distill Qwen 32B (Cloudflare)',
		contextLength: 80000,
	},
	'cloudflare/gemma-3-12b': {
		id: '@cf/google/gemma-3-12b-it',
		provider: 'cloudflare',
		name: 'Gemma 3 12B (Cloudflare)',
		contextLength: 128000,
	},
	// Cohere — Command A is the flagship as of 2025.
	'cohere/command-a': {
		id: 'command-a-03-2025',
		provider: 'cohere',
		name: 'Command A',
		contextLength: 256000,
	},
	'cohere/command-r-plus': {
		id: 'command-r-plus-08-2024',
		provider: 'cohere',
		name: 'Command R+',
		contextLength: 128000,
	},
	'cohere/command-r': {
		id: 'command-r-08-2024',
		provider: 'cohere',
		name: 'Command R',
		contextLength: 128000,
	},
	'cohere/command-r7b': {
		id: 'command-r7b-12-2024',
		provider: 'cohere',
		name: 'Command R7B',
		contextLength: 128000,
	},
	// Ollama — models are whatever the user has pulled. These are common
	// defaults for auto-complete; context length varies by pull tag.
	'ollama/llama3.3': {
		id: 'llama3.3',
		provider: 'ollama',
		name: 'Llama 3.3 (Ollama)',
		contextLength: 128000,
	},
	'ollama/llama3.1': {
		id: 'llama3.1',
		provider: 'ollama',
		name: 'Llama 3.1 (Ollama)',
		contextLength: 128000,
	},
	'ollama/qwen2.5-coder': {
		id: 'qwen2.5-coder',
		provider: 'ollama',
		name: 'Qwen 2.5 Coder (Ollama)',
		contextLength: 32000,
	},
	'ollama/deepseek-r1': {
		id: 'deepseek-r1',
		provider: 'ollama',
		name: 'DeepSeek R1 (Ollama)',
		contextLength: 64000,
	},
	// Azure OpenAI — underlying models are the same OpenAI shapes. Deployment
	// name lives in credentials; these entries are for pricing/logging.
	'azure/gpt-4o': {
		id: 'gpt-4o',
		provider: 'azure',
		name: 'Azure GPT-4o',
		contextLength: 128000,
	},
	'azure/gpt-4.1': {
		id: 'gpt-4.1',
		provider: 'azure',
		name: 'Azure GPT-4.1',
		contextLength: 1047576,
	},
	'azure/gpt-5': {
		id: 'gpt-5',
		provider: 'azure',
		name: 'Azure GPT-5',
		contextLength: 1047576,
	},
	'azure/o4-mini': {
		id: 'o4-mini',
		provider: 'azure',
		name: 'Azure o4-mini',
		contextLength: 200000,
	},
} as const

export function resolveModel(modelString: string): ModelConfig | undefined {
	if (MODELS[modelString]) return MODELS[modelString]
	// Try stripping the "provider/" prefix and matching on native id
	const slashIdx = modelString.indexOf('/')
	const native = slashIdx >= 0 ? modelString.substring(slashIdx + 1) : modelString
	return Object.values(MODELS).find((m) => m.id === native)
}

export function getProviderForModel(modelString: string): string | undefined {
	const model = resolveModel(modelString)
	return model?.provider
}

/** Context length for a model, or undefined if unknown. */
export function getContextLength(modelString: string): number | undefined {
	return resolveModel(modelString)?.contextLength
}

/**
 * Rough token count for a set of chat messages. Uses the 4-chars-per-token
 * heuristic — slightly over-estimates for English (better for a context-fit
 * guard to err on the safe side) and slightly under for code-dense input.
 * Not accurate enough for billing, but fine for "does this fit in 128k?".
 */
export function estimateTokens(messages: Array<{ content: string | unknown }>): number {
	let chars = 0
	for (const m of messages) {
		if (typeof m.content === 'string') {
			chars += m.content.length
		} else if (Array.isArray(m.content)) {
			for (const part of m.content) {
				if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
					chars += part.text.length
				}
			}
		}
	}
	return Math.ceil(chars / 4)
}

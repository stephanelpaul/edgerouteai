import { MODELS, resolveModel } from './models.js'

export interface ModelPricing {
	inputPerMillion: number
	outputPerMillion: number
}

export const PRICING: Record<string, ModelPricing> = {
	// OpenAI
	'openai/gpt-5.4': { inputPerMillion: 2.5, outputPerMillion: 15 },
	'openai/gpt-5.4-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
	'openai/gpt-5.2': { inputPerMillion: 1.75, outputPerMillion: 14 },
	'openai/gpt-5': { inputPerMillion: 1.25, outputPerMillion: 10 },
	'openai/gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
	'openai/gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
	'openai/o3': { inputPerMillion: 10, outputPerMillion: 40 },
	'openai/o4-mini': { inputPerMillion: 1.1, outputPerMillion: 4.4 },
	// Anthropic
	'anthropic/claude-opus-4-6': { inputPerMillion: 5, outputPerMillion: 25 },
	'anthropic/claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
	'anthropic/claude-sonnet-4-5': { inputPerMillion: 3, outputPerMillion: 15 },
	'anthropic/claude-haiku-4-5': { inputPerMillion: 0.8, outputPerMillion: 4 },
	// Google
	'google/gemini-2.5-pro': { inputPerMillion: 1, outputPerMillion: 10 },
	'google/gemini-2.5-flash': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
	'google/gemini-2.5-flash-lite': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
	// Mistral
	'mistral/mistral-large': { inputPerMillion: 2, outputPerMillion: 6 },
	'mistral/mistral-medium': { inputPerMillion: 1, outputPerMillion: 3 },
	'mistral/mistral-small': { inputPerMillion: 0.2, outputPerMillion: 0.6 },
	// xAI
	'xai/grok-4.20': { inputPerMillion: 2, outputPerMillion: 6 },
	// Groq (paid-tier prices; free tier available separately via Groq)
	'groq/llama-3.3-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
	'groq/llama-3.1-8b-instant': { inputPerMillion: 0.05, outputPerMillion: 0.08 },
	'groq/deepseek-r1-distill-llama-70b': { inputPerMillion: 0.75, outputPerMillion: 0.99 },
	'groq/qwen-2.5-coder-32b': { inputPerMillion: 0.79, outputPerMillion: 0.79 },
	'groq/mixtral-8x7b-32768': { inputPerMillion: 0.24, outputPerMillion: 0.24 },
	// Together AI
	'together/llama-3.3-70b': { inputPerMillion: 0.88, outputPerMillion: 0.88 },
	'together/llama-3.1-8b': { inputPerMillion: 0.18, outputPerMillion: 0.18 },
	'together/qwen-2.5-72b': { inputPerMillion: 1.2, outputPerMillion: 1.2 },
	'together/qwen-2.5-coder-32b': { inputPerMillion: 0.8, outputPerMillion: 0.8 },
	'together/deepseek-v3': { inputPerMillion: 1.25, outputPerMillion: 1.25 },
	'together/deepseek-r1': { inputPerMillion: 3, outputPerMillion: 7 },
	// Cloudflare Workers AI (neurons billed; rough USD-equivalent per Mtok)
	'cloudflare/llama-3.3-70b': { inputPerMillion: 0.29, outputPerMillion: 2.25 },
	'cloudflare/llama-3.1-8b': { inputPerMillion: 0.15, outputPerMillion: 0.15 },
	'cloudflare/llama-3.2-3b': { inputPerMillion: 0.051, outputPerMillion: 0.051 },
	'cloudflare/mistral-small': { inputPerMillion: 0.35, outputPerMillion: 0.55 },
	'cloudflare/deepseek-r1-distill': { inputPerMillion: 0.5, outputPerMillion: 4.88 },
	'cloudflare/gemma-3-12b': { inputPerMillion: 0.35, outputPerMillion: 0.56 },
	// Cohere (2025 rate card)
	'cohere/command-a': { inputPerMillion: 2.5, outputPerMillion: 10 },
	'cohere/command-r-plus': { inputPerMillion: 2.5, outputPerMillion: 10 },
	'cohere/command-r': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
	'cohere/command-r7b': { inputPerMillion: 0.0375, outputPerMillion: 0.15 },
	// Ollama — self-hosted, zero inference cost. Compute bills are the user's
	// electricity. We still list $0 so cost-aware routing doesn't drop them.
	'ollama/llama3.3': { inputPerMillion: 0, outputPerMillion: 0 },
	'ollama/llama3.1': { inputPerMillion: 0, outputPerMillion: 0 },
	'ollama/qwen2.5-coder': { inputPerMillion: 0, outputPerMillion: 0 },
	'ollama/deepseek-r1': { inputPerMillion: 0, outputPerMillion: 0 },
	// Azure OpenAI — PAYG prices match OpenAI proper.
	'azure/gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
	'azure/gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
	'azure/gpt-5': { inputPerMillion: 1.25, outputPerMillion: 10 },
	'azure/o4-mini': { inputPerMillion: 1.1, outputPerMillion: 4.4 },
}

export function calculateCost(
	modelString: string,
	inputTokens: number,
	outputTokens: number,
): number {
	const pricing = getPricing(modelString)
	if (!pricing) return 0
	return (
		(inputTokens / 1_000_000) * pricing.inputPerMillion +
		(outputTokens / 1_000_000) * pricing.outputPerMillion
	)
}

/**
 * Resolve pricing for a model string, with fallback canonicalization so the
 * rankings in the router (which use provider-native names like
 * "google/gemini-2.5-pro-preview-03-25" or "mistral/mistral-large-latest")
 * still find their price row (stored under the canonical
 * "google/gemini-2.5-pro" / "mistral/mistral-large"). Also tries stripping
 * arbitrary date / tag suffixes (e.g. "-08-2024") by falling back to a
 * reverse lookup through the MODELS catalog via resolveModel().
 */
export function getPricing(modelString: string): ModelPricing | undefined {
	if (PRICING[modelString]) return PRICING[modelString]
	const withoutPreview = modelString.replace(/-preview-\d{4}-\d{2}-\d{2}$/, '')
	if (PRICING[withoutPreview]) return PRICING[withoutPreview]
	const withoutLatest = modelString.replace(/-latest$/, '')
	if (PRICING[withoutLatest]) return PRICING[withoutLatest]
	// Fallback: if the string is a provider-native id (e.g. "cohere/command-r-plus-08-2024"
	// or just "command-r-plus-08-2024"), reverse-resolve via MODELS to find
	// the canonical pricing key.
	const resolved = resolveModel(modelString)
	if (resolved) {
		for (const [key, model] of Object.entries(MODELS)) {
			if (model === resolved && PRICING[key]) return PRICING[key]
		}
	}
	return undefined
}

/** Average USD per million tokens (input + output average). Infinity if unpriced. */
export function avgCostPerMTok(modelString: string): number {
	const p = getPricing(modelString)
	if (!p) return Number.POSITIVE_INFINITY
	return (p.inputPerMillion + p.outputPerMillion) / 2
}

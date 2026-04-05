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
}

export function calculateCost(
	modelString: string,
	inputTokens: number,
	outputTokens: number,
): number {
	const pricing = PRICING[modelString]
	if (!pricing) return 0
	return (
		(inputTokens / 1_000_000) * pricing.inputPerMillion +
		(outputTokens / 1_000_000) * pricing.outputPerMillion
	)
}

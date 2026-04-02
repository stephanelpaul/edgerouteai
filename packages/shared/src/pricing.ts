export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
}

export const PRICING: Record<string, ModelPricing> = {
  'openai/gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'openai/gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
  'openai/o3': { inputPerMillion: 10, outputPerMillion: 40 },
  'openai/o4-mini': { inputPerMillion: 1.1, outputPerMillion: 4.4 },
  'anthropic/claude-opus-4-6': { inputPerMillion: 15, outputPerMillion: 75 },
  'anthropic/claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
  'anthropic/claude-haiku-4-5': { inputPerMillion: 0.8, outputPerMillion: 4 },
  'google/gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
  'google/gemini-2.5-flash': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'mistral/mistral-large': { inputPerMillion: 2, outputPerMillion: 6 },
  'mistral/mistral-medium': { inputPerMillion: 0.4, outputPerMillion: 2 },
  'xai/grok-4.20': { inputPerMillion: 3, outputPerMillion: 15 },
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

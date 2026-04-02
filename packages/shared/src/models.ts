export interface ModelConfig {
  id: string
  provider: string
  name: string
  contextLength: number
}

export const MODELS: Record<string, ModelConfig> = {
  // OpenAI
  'openai/gpt-4o': { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', contextLength: 128000 },
  'openai/gpt-4.1': { id: 'gpt-4.1', provider: 'openai', name: 'GPT-4.1', contextLength: 1047576 },
  'openai/o3': { id: 'o3', provider: 'openai', name: 'o3', contextLength: 200000 },
  'openai/o4-mini': { id: 'o4-mini', provider: 'openai', name: 'o4-mini', contextLength: 200000 },
  // Anthropic
  'anthropic/claude-opus-4-6': { id: 'claude-opus-4-6', provider: 'anthropic', name: 'Claude Opus 4.6', contextLength: 1000000 },
  'anthropic/claude-sonnet-4-6': { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', contextLength: 1000000 },
  'anthropic/claude-haiku-4-5': { id: 'claude-haiku-4-5', provider: 'anthropic', name: 'Claude Haiku 4.5', contextLength: 200000 },
  // Google
  'google/gemini-2.5-pro': { id: 'gemini-2.5-pro-preview-03-25', provider: 'google', name: 'Gemini 2.5 Pro', contextLength: 1048576 },
  'google/gemini-2.5-flash': { id: 'gemini-2.5-flash-preview-04-17', provider: 'google', name: 'Gemini 2.5 Flash', contextLength: 1048576 },
  // Mistral
  'mistral/mistral-large': { id: 'mistral-large-latest', provider: 'mistral', name: 'Mistral Large', contextLength: 131072 },
  'mistral/mistral-medium': { id: 'mistral-medium-latest', provider: 'mistral', name: 'Mistral Medium', contextLength: 131072 },
  // xAI
  'xai/grok-4.20': { id: 'grok-4.20', provider: 'xai', name: 'Grok 4.20', contextLength: 131072 },
} as const

export function resolveModel(modelString: string): ModelConfig | undefined {
  if (MODELS[modelString]) return MODELS[modelString]
  return Object.values(MODELS).find((m) => m.id === modelString)
}

export function getProviderForModel(modelString: string): string | undefined {
  const model = resolveModel(modelString)
  return model?.provider
}

export interface ProviderConfig {
  id: string
  name: string
  baseUrl: string
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  google: {
    id: 'google',
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
  },
} as const

export type ProviderId = keyof typeof PROVIDERS

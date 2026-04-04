import type { ProviderAdapter } from './types.js'
import { openaiAdapter } from './openai.js'
import { anthropicAdapter } from './anthropic.js'
import { googleAdapter } from './google.js'
import { mistralAdapter } from './mistral.js'
import { xaiAdapter } from './xai.js'

const adapters: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  mistral: mistralAdapter,
  xai: xaiAdapter,
}

export function getAdapter(providerId: string): ProviderAdapter | undefined {
  return adapters[providerId]
}

export function getAllAdapters(): ProviderAdapter[] {
  return Object.values(adapters)
}

import { anthropicAdapter } from './anthropic.js'
import { azureAdapter } from './azure.js'
import { cloudflareAdapter } from './cloudflare.js'
import { cohereAdapter } from './cohere.js'
import { googleAdapter } from './google.js'
import { groqAdapter } from './groq.js'
import { mistralAdapter } from './mistral.js'
import { ollamaAdapter } from './ollama.js'
import { openaiAdapter } from './openai.js'
import { togetherAdapter } from './together.js'
import type { ProviderAdapter } from './types.js'
import { xaiAdapter } from './xai.js'

const adapters: Record<string, ProviderAdapter> = {
	openai: openaiAdapter,
	anthropic: anthropicAdapter,
	google: googleAdapter,
	mistral: mistralAdapter,
	xai: xaiAdapter,
	groq: groqAdapter,
	together: togetherAdapter,
	cloudflare: cloudflareAdapter,
	cohere: cohereAdapter,
	ollama: ollamaAdapter,
	azure: azureAdapter,
}

export function getAdapter(providerId: string): ProviderAdapter | undefined {
	return adapters[providerId]
}

export function getAllAdapters(): ProviderAdapter[] {
	return Object.values(adapters)
}

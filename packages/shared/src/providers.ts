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
	groq: {
		id: 'groq',
		name: 'Groq',
		baseUrl: 'https://api.groq.com/openai/v1',
	},
	together: {
		id: 'together',
		name: 'Together AI',
		baseUrl: 'https://api.together.xyz/v1',
	},
	cloudflare: {
		id: 'cloudflare',
		name: 'Cloudflare Workers AI',
		// Base URL is templated with account_id at request time; this is the
		// closest static fragment we can surface in metadata.
		baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
	},
	cohere: {
		id: 'cohere',
		name: 'Cohere',
		baseUrl: 'https://api.cohere.com/compatibility/v1',
	},
	ollama: {
		id: 'ollama',
		name: 'Ollama (self-hosted)',
		// User provides their own base URL in the credential field.
		baseUrl: '{user-provided-base-url}/v1',
	},
	azure: {
		id: 'azure',
		name: 'Azure OpenAI',
		baseUrl: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}',
	},
} as const

export type ProviderId = keyof typeof PROVIDERS

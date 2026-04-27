import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ProviderRequest,
	TokenUsage,
} from '@edgerouteai/shared'
import type { ProviderAdapter } from './types.js'

// Azure OpenAI has a different URL shape than OpenAI proper:
//   https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions
//     ?api-version={apiVersion}
// and uses an `api-key` header instead of `Authorization: Bearer`.
//
// Three pieces of config are needed (resource name, deployment name,
// api-key). We encode them as `{resource}:{deployment}:{apiVersion}:{apiKey}`
// in the existing single-string provider_keys field. Only the FIRST THREE
// colons are treated as separators; anything after is the api-key (api-keys
// never contain colons at present, but this is safer regardless).
//
// The model id passed in the request is IGNORED by Azure (the deployment
// name in the URL picks the model). Callers should still pass a canonical
// model id like "azure/gpt-4o" so the request_logs and billing math work.

const DEFAULT_API_VERSION = '2024-10-21'

export const azureAdapter: ProviderAdapter = {
	id: 'azure',
	// Azure deployment names are per-tenant; these are the common underlying
	// model shapes we log against. The user's real deployment name goes in
	// the credential, not here.
	models: ['gpt-4o', 'gpt-4.1', 'gpt-5', 'o4-mini', 'o3'],

	transformRequest(req: ChatCompletionRequest, apiKey: string): ProviderRequest {
		const parts = splitUpToN(apiKey, ':', 4)
		if (parts.length < 3) {
			throw new Error(
				'Azure OpenAI credential must be formatted as ' +
					'"<resource>:<deployment>:<apiVersion>:<api-key>" (api-version is optional).',
			)
		}
		const [resource, deployment, maybeVersion, maybeKey] = parts
		// Support both 3-part ({resource}:{deployment}:{key}, defaulting
		// apiVersion) and 4-part formats.
		let apiVersion: string
		let key: string
		if (parts.length === 3) {
			apiVersion = DEFAULT_API_VERSION
			key = maybeVersion
		} else {
			apiVersion = maybeVersion
			key = maybeKey
		}

		const body: Record<string, unknown> = {
			messages: req.messages,
			stream: req.stream ?? true,
		}
		if (req.stream !== false) {
			body.stream_options = { include_usage: true }
		}
		if (req.temperature !== undefined) body.temperature = req.temperature
		if (req.top_p !== undefined) body.top_p = req.top_p
		if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens
		if (req.stop !== undefined) body.stop = req.stop
		// Azure does NOT accept the model field — it's keyed off the deployment.

		return {
			url: `https://${resource}.openai.azure.com/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
			headers: {
				'api-key': key,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		}
	},

	transformStreamChunk(raw: string): ChatCompletionChunk | null {
		if (!raw || raw === '[DONE]') return null
		try {
			return JSON.parse(raw) as ChatCompletionChunk
		} catch {
			return null
		}
	},

	extractUsageFromChunks(chunks: ChatCompletionChunk[]): TokenUsage {
		for (let i = chunks.length - 1; i >= 0; i--) {
			if (chunks[i].usage) return chunks[i].usage as TokenUsage
		}
		return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
	},
}

/** Split `str` on `sep` but stop after `n` splits so the remainder is intact. */
function splitUpToN(str: string, sep: string, n: number): string[] {
	const out: string[] = []
	let rest = str
	for (let i = 0; i < n - 1; i++) {
		const idx = rest.indexOf(sep)
		if (idx === -1) {
			out.push(rest)
			return out
		}
		out.push(rest.slice(0, idx))
		rest = rest.slice(idx + 1)
	}
	out.push(rest)
	return out
}

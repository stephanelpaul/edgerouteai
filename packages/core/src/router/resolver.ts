import { getAdapter, getAllAdapters } from '../adapters/registry.js'
import type { ProviderAdapter } from '../adapters/types.js'

export interface ResolvedRoute {
	provider: string
	modelId: string
	adapter: ProviderAdapter
}

export function resolveRoute(modelString: string): ResolvedRoute | null {
	const slashIndex = modelString.indexOf('/')
	if (slashIndex !== -1) {
		const provider = modelString.substring(0, slashIndex)
		const modelId = modelString.substring(slashIndex + 1)
		const adapter = getAdapter(provider)
		if (adapter?.models.includes(modelId)) {
			return { provider, modelId, adapter }
		}
		return null
	}
	for (const adapter of getAllAdapters()) {
		if (adapter.models.includes(modelString)) {
			return { provider: adapter.id, modelId: modelString, adapter }
		}
	}
	return null
}

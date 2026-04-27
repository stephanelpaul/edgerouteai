export { openaiAdapter } from './adapters/openai.js'
export { anthropicAdapter } from './adapters/anthropic.js'
export { googleAdapter } from './adapters/google.js'
export { mistralAdapter } from './adapters/mistral.js'
export { xaiAdapter } from './adapters/xai.js'
export { groqAdapter } from './adapters/groq.js'
export { togetherAdapter } from './adapters/together.js'
export { cloudflareAdapter } from './adapters/cloudflare.js'
export { cohereAdapter } from './adapters/cohere.js'
export { ollamaAdapter } from './adapters/ollama.js'
export { azureAdapter } from './adapters/azure.js'
export { getAdapter, getAllAdapters } from './adapters/registry.js'
export type { ProviderAdapter } from './adapters/types.js'
export { resolveRoute, type ResolvedRoute } from './router/resolver.js'
export {
	autoRoute,
	type CostTier,
	type AutoRouteOptions,
	type AutoRouteResult,
} from './router/auto.js'
export {
	classifyTaskType,
	detectTaskTypeKeyword,
	buildClassifierPrompt,
	parseClassification,
	lastUserText,
	type TaskType,
	type ClassifyOptions,
} from './router/classifier.js'
export { buildFallbackChain } from './router/fallback.js'
export {
	type DemotionEntry,
	type DemotionMap,
	filterDemoted,
	modelKey,
	purgeExpired,
	recordFailure,
	recordSuccess,
	FAILURE_WINDOW_MS,
	FAILURE_THRESHOLD,
	BASE_COOLDOWN_MS,
	MAX_COOLDOWN_MS,
} from './router/health.js'
export { proxyRequest, type ProxyRequestOptions, type ProxyResult } from './streaming/proxy.js'
export { teeStream } from './streaming/tee.js'

export interface Env {
	DB: D1Database
	RATE_LIMIT: KVNamespace
	CACHE: KVNamespace
	ENCRYPTION_KEY: string
	ENVIRONMENT: string
	/**
	 * Set to "1" to enable the LLM-backed task classifier (smart-router v2).
	 * When unset/anything else, the router falls back to keyword detection.
	 */
	SMART_ROUTER_LLM?: string
}

export interface AppContext {
	Bindings: Env
	Variables: {
		userId: string
		apiKeyId: string
		retryCount: number
		timeoutMs: number
		role: string
	}
}

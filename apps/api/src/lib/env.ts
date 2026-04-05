export interface Env {
  DB: D1Database
  RATE_LIMIT: KVNamespace
  CACHE: KVNamespace
  ENCRYPTION_KEY: string
  ENVIRONMENT: string
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

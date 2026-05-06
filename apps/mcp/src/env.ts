export interface McpEnv {
	DB: D1Database
	ENVIRONMENT: string
	API_BASE_URL: string
}

export interface McpContext {
	Bindings: McpEnv
	Variables: {
		userId: string
		apiKey: string
	}
}

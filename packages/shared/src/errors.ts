export class EdgeRouteError extends Error {
	constructor(
		message: string,
		public code: string,
		public status: number,
	) {
		super(message)
		this.name = 'EdgeRouteError'
	}

	toJSON() {
		return {
			error: {
				message: this.message,
				code: this.code,
				type: 'edgeroute_error',
			},
		}
	}
}

export class AuthenticationError extends EdgeRouteError {
	constructor(message = 'Invalid API key') {
		super(message, 'invalid_api_key', 401)
	}
}

export class RateLimitError extends EdgeRouteError {
	constructor(message = 'Rate limit exceeded') {
		super(message, 'rate_limit_exceeded', 429)
	}
}

export class ProviderError extends EdgeRouteError {
	constructor(
		public provider: string,
		message: string,
		status: number,
	) {
		super(message, 'provider_error', status)
	}
}

export class ModelNotFoundError extends EdgeRouteError {
	constructor(model: string) {
		super(`Model not found: ${model}`, 'model_not_found', 404)
	}
}

export class ProviderKeyMissingError extends EdgeRouteError {
	constructor(provider: string) {
		super(
			`No API key configured for provider: ${provider}. Add your key in the dashboard.`,
			'provider_key_missing',
			400,
		)
	}
}

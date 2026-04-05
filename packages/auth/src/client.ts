import { createAuthClient } from 'better-auth/client'

export function createEdgeRouteAuthClient(baseURL: string) {
	return createAuthClient({
		baseURL,
	})
}

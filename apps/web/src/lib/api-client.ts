const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

interface FetchOptions extends RequestInit {
	token?: string
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
	const { token, ...fetchOptions } = options
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...((fetchOptions.headers as Record<string, string>) ?? {}),
	}
	if (token) headers.Authorization = `Bearer ${token}`
	const response = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers })
	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
		throw new Error(error.error?.message ?? `API error: ${response.status}`)
	}
	return response.json()
}

export const api = {
	listKeys: (token: string) => apiFetch<{ keys: any[] }>('/api/keys', { token }),
	createKey: (token: string, data: { name: string }) =>
		apiFetch<{ id: string; key: string; name: string }>('/api/keys', {
			token,
			method: 'POST',
			body: JSON.stringify(data),
		}),
	revokeKey: (token: string, id: string) =>
		apiFetch(`/api/keys/${id}`, { token, method: 'DELETE' }),
	listProviders: (token: string) => apiFetch<{ keys: any[] }>('/api/providers', { token }),
	setProviderKey: (token: string, provider: string, apiKey: string) =>
		apiFetch(`/api/providers/${provider}`, {
			token,
			method: 'PUT',
			body: JSON.stringify({ apiKey }),
		}),
	deleteProviderKey: (token: string, provider: string) =>
		apiFetch(`/api/providers/${provider}`, { token, method: 'DELETE' }),
	verifyProviderKey: (token: string, provider: string) =>
		apiFetch<{ valid: boolean }>(`/api/providers/${provider}/verify`, { token, method: 'POST' }),
	getLogs: (token: string, params?: Record<string, string>) => {
		const qs = new URLSearchParams(params).toString()
		return apiFetch<{ logs: any[] }>(`/api/logs?${qs}`, { token })
	},
	getStats: (token: string, days?: number) =>
		apiFetch<{ stats: any }>(`/api/stats?days=${days ?? 7}`, { token }),
	listRouting: (token: string) => apiFetch<{ configs: any[] }>('/api/routing', { token }),
	createRouting: (token: string, data: { name: string; fallbackChain: string[] }) =>
		apiFetch('/api/routing', { token, method: 'POST', body: JSON.stringify(data) }),
	deleteRouting: (token: string, id: string) =>
		apiFetch(`/api/routing/${id}`, { token, method: 'DELETE' }),
}

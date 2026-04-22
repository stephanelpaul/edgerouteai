'use client'
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://edgerouteai-api.remediumdev.workers.dev'

interface User {
	id: string
	email: string
	name: string | null
	role: string
}

interface AuthContextType {
	user: User | null
	apiKey: string | null
	apiUrl: string
	isAuthenticated: boolean
	isAdmin: boolean
	isSuperadmin: boolean
	isLoading: boolean
	login: (email: string, password: string) => Promise<void>
	signup: (name: string, email: string, password: string) => Promise<{ isFirstUser?: boolean }>
	logout: () => Promise<void>
	setApiKey: (key: string | null) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [apiKey, setApiKeyState] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	// Check session on mount
	useEffect(() => {
		checkSession()
		// Also load API key from localStorage
		const stored = localStorage.getItem('edgeroute-api-key')
		if (stored) setApiKeyState(stored)
	}, [])

	const checkSession = async () => {
		try {
			const res = await fetch(`${API_URL}/api/auth/get-session`, { credentials: 'include' })
			if (res.ok) {
				const data = await res.json()
				if (data?.user) {
					setUser({
						id: data.user.id,
						email: data.user.email,
						name: data.user.name,
						role: data.user.role ?? 'user',
					})
				}
			}
		} catch {}
		setIsLoading(false)
	}

	const login = async (email: string, password: string) => {
		const res = await fetch(`${API_URL}/api/auth/sign-in/email`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ email, password }),
		})
		if (!res.ok) {
			const data = await res.json().catch(() => ({}))
			throw new Error((data as any).error?.message ?? (data as any).message ?? 'Login failed')
		}
		const data = await res.json()
		if ((data as any).user) {
			setUser({
				id: (data as any).user.id,
				email: (data as any).user.email,
				name: (data as any).user.name,
				role: (data as any).user.role ?? 'user',
			})
		}
	}

	const signup = async (
		name: string,
		email: string,
		password: string,
	): Promise<{ isFirstUser?: boolean }> => {
		const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ name, email, password }),
		})
		if (!res.ok) {
			const data = await res.json().catch(() => ({}))
			throw new Error((data as any).error?.message ?? (data as any).message ?? 'Signup failed')
		}
		const data = await res.json()
		if ((data as any).user) {
			setUser({
				id: (data as any).user.id,
				email: (data as any).user.email,
				name: (data as any).user.name,
				role: (data as any).user.role ?? 'user',
			})
			// Auto-create first API key
			try {
				const keyRes = await fetch(`${API_URL}/api/account/me/create-key`, {
					method: 'POST',
					credentials: 'include',
				})
				if (keyRes.ok) {
					const keyData = await keyRes.json()
					setApiKey((keyData as any).key)
				}
			} catch {}
		}
		return { isFirstUser: (data as any).isFirstUser ?? false }
	}

	const logout = async () => {
		await fetch(`${API_URL}/api/auth/sign-out`, { method: 'POST', credentials: 'include' })
		setUser(null)
		setApiKeyState(null)
		localStorage.removeItem('edgeroute-api-key')
	}

	const setApiKey = (key: string | null) => {
		setApiKeyState(key)
		if (key) localStorage.setItem('edgeroute-api-key', key)
		else localStorage.removeItem('edgeroute-api-key')
	}

	const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
	const isSuperadmin = user?.role === 'superadmin'

	return (
		<AuthContext.Provider
			value={{
				user,
				apiKey,
				apiUrl: API_URL,
				isAuthenticated: !!user,
				isAdmin,
				isSuperadmin,
				isLoading,
				login,
				signup,
				logout,
				setApiKey,
			}}
		>
			{children}
		</AuthContext.Provider>
	)
}

export function useAuth() {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used within AuthProvider')
	return ctx
}

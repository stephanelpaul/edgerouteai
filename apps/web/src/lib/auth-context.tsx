'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface AuthContextType {
  apiKey: string | null
  apiUrl: string
  setApiKey: (key: string | null) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://edgerouteai-api.remediumdev.workers.dev'

  useEffect(() => {
    const stored = localStorage.getItem('edgeroute-api-key')
    if (stored) setApiKeyState(stored)
  }, [])

  const setApiKey = (key: string | null) => {
    setApiKeyState(key)
    if (key) localStorage.setItem('edgeroute-api-key', key)
    else localStorage.removeItem('edgeroute-api-key')
  }

  return (
    <AuthContext.Provider value={{ apiKey, apiUrl, setApiKey, isAuthenticated: !!apiKey }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

import type { Database } from '@edgerouteai/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

export function createAuth(
	db: Database,
	options?: { baseURL?: string; secret?: string; trustedOrigins?: string[] },
) {
	return betterAuth({
		database: drizzleAdapter(db, { provider: 'sqlite' }),
		baseURL: options?.baseURL,
		secret: options?.secret,
		trustedOrigins: options?.trustedOrigins,
		emailAndPassword: {
			enabled: true,
		},
		advanced: {
			crossSubDomainCookies: {
				enabled: false,
			},
			defaultCookieAttributes: {
				secure: true,
				sameSite: 'none',
				path: '/',
			},
		},
	})
}

export type Auth = ReturnType<typeof createAuth>

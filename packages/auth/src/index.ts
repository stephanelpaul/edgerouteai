import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Database } from '@edgerouteai/db'

export function createAuth(db: Database, options?: { baseURL?: string; secret?: string }) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    baseURL: options?.baseURL,
    secret: options?.secret,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

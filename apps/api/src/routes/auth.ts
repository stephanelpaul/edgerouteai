import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import type { AppContext } from '../lib/env.js'

const authRoute = new Hono<AppContext>()

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16))
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	)
	const hash = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
		keyMaterial,
		256,
	)
	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
	const hashHex = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
	return `${saltHex}:${hashHex}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, hashHex] = stored.split(':')
	const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map((b) => Number.parseInt(b, 16)))
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	)
	const hash = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
		keyMaterial,
		256,
	)
	const computed = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
	return computed === hashHex
}

function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32))
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

const SESSION_COOKIE = 'edgeroute_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
	if (!cookieHeader) return null
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
	return match ? match[1] : null
}

// ──────────────────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────────────────

// Health check
authRoute.get('/ok', (c) => c.json({ ok: true }))

// POST /api/auth/sign-up/email
authRoute.post('/sign-up/email', async (c) => {
	try {
		const body = await c.req.json<{ name?: string; email?: string; password?: string }>()
		const { name, email, password } = body

		if (!name || !email || !password) {
			return c.json(
				{ error: { message: 'name, email, and password are required', code: 'validation_error' } },
				400,
			)
		}
		if (password.length < 8) {
			return c.json(
				{ error: { message: 'Password must be at least 8 characters', code: 'validation_error' } },
				400,
			)
		}

		const db = c.env.DB

		// Check if email already exists
		const existing = await db.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first()
		if (existing) {
			return c.json({ error: { message: 'Email already in use', code: 'email_exists' } }, 409)
		}

		// First user ever becomes superadmin
		const userCount = await db
			.prepare('SELECT COUNT(*) as count FROM "user"')
			.first<{ count: number }>()
		const role = userCount?.count === 0 ? 'superadmin' : 'user'

		const userId = crypto.randomUUID()
		const accountId = crypto.randomUUID()
		const sessionId = crypto.randomUUID()
		const now = Date.now()
		const hashedPassword = await hashPassword(password)
		const sessionToken = generateSessionToken()
		const expiresAt = now + SESSION_MAX_AGE * 1000

		// Insert into "user" table (Better Auth compatible)
		await db
			.prepare(
				'INSERT INTO "user" ("id","name","email","emailVerified","role","createdAt","updatedAt") VALUES (?,?,?,1,?,?,?)',
			)
			.bind(userId, name, email, role, now, now)
			.run()

		// Insert into "account" table
		await db
			.prepare(
				'INSERT INTO "account" ("id","accountId","providerId","userId","password","createdAt","updatedAt") VALUES (?,?,\'credential\',?,?,?,?)',
			)
			.bind(accountId, userId, userId, hashedPassword, now, now)
			.run()

		// Insert into our app "users" table (for FK references)
		await db
			.prepare('INSERT OR IGNORE INTO "users" ("id","email","name","created_at") VALUES (?,?,?,?)')
			.bind(userId, email, name, now)
			.run()

		// Create session
		await db
			.prepare(
				'INSERT INTO "session" ("id","token","userId","expiresAt","createdAt","updatedAt") VALUES (?,?,?,?,?,?)',
			)
			.bind(sessionId, sessionToken, userId, expiresAt, now, now)
			.run()

		setCookie(c, SESSION_COOKIE, sessionToken, {
			httpOnly: true,
			secure: true,
			sameSite: 'None',
			path: '/',
			maxAge: SESSION_MAX_AGE,
		})

		return c.json(
			{
				user: { id: userId, name, email, role },
				session: { token: sessionToken, expiresAt },
				isFirstUser: role === 'superadmin',
			},
			201,
		)
	} catch (err) {
		console.error('sign-up error:', err)
		return c.json(
			{ error: { message: 'Internal error during sign-up', code: 'internal_error' } },
			500,
		)
	}
})

// POST /api/auth/sign-in/email
authRoute.post('/sign-in/email', async (c) => {
	try {
		const body = await c.req.json<{ email?: string; password?: string }>()
		const { email, password } = body

		if (!email || !password) {
			return c.json(
				{ error: { message: 'email and password are required', code: 'validation_error' } },
				400,
			)
		}

		const db = c.env.DB

		// Find user
		const userRow = await db
			.prepare('SELECT id, name, email, role FROM "user" WHERE email = ?')
			.bind(email)
			.first<{ id: string; name: string; email: string; role: string }>()

		if (!userRow) {
			return c.json(
				{ error: { message: 'Invalid email or password', code: 'invalid_credentials' } },
				401,
			)
		}

		// Find credential account
		const accountRow = await db
			.prepare(
				'SELECT password FROM "account" WHERE "userId" = ? AND "providerId" = \'credential\'',
			)
			.bind(userRow.id)
			.first<{ password: string }>()

		if (!accountRow?.password) {
			return c.json(
				{ error: { message: 'Invalid email or password', code: 'invalid_credentials' } },
				401,
			)
		}

		const valid = await verifyPassword(password, accountRow.password)
		if (!valid) {
			return c.json(
				{ error: { message: 'Invalid email or password', code: 'invalid_credentials' } },
				401,
			)
		}

		const sessionId = crypto.randomUUID()
		const sessionToken = generateSessionToken()
		const now = Date.now()
		const expiresAt = now + SESSION_MAX_AGE * 1000

		await db
			.prepare(
				'INSERT INTO "session" ("id","token","userId","expiresAt","createdAt","updatedAt") VALUES (?,?,?,?,?,?)',
			)
			.bind(sessionId, sessionToken, userRow.id, expiresAt, now, now)
			.run()

		setCookie(c, SESSION_COOKIE, sessionToken, {
			httpOnly: true,
			secure: true,
			sameSite: 'None',
			path: '/',
			maxAge: SESSION_MAX_AGE,
		})

		return c.json({
			user: {
				id: userRow.id,
				name: userRow.name,
				email: userRow.email,
				role: userRow.role ?? 'user',
			},
			session: { token: sessionToken, expiresAt },
		})
	} catch (err) {
		console.error('sign-in error:', err)
		return c.json(
			{ error: { message: 'Internal error during sign-in', code: 'internal_error' } },
			500,
		)
	}
})

// POST /api/auth/sign-out
authRoute.post('/sign-out', async (c) => {
	try {
		const cookieHeader = c.req.header('Cookie')
		const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE)

		if (sessionToken) {
			await c.env.DB.prepare('DELETE FROM "session" WHERE token = ?').bind(sessionToken).run()
		}

		deleteCookie(c, SESSION_COOKIE, { path: '/' })

		return c.json({ ok: true })
	} catch (err) {
		console.error('sign-out error:', err)
		return c.json(
			{ error: { message: 'Internal error during sign-out', code: 'internal_error' } },
			500,
		)
	}
})

// GET /api/auth/get-session
authRoute.get('/get-session', async (c) => {
	try {
		const cookieHeader = c.req.header('Cookie')
		const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE)

		if (!sessionToken) {
			return c.json({ session: null, user: null })
		}

		const now = Date.now()
		const row = await c.env.DB.prepare(
			'SELECT s.id as sessionId, s.expiresAt, u.id as uid, u.name, u.email, u.role FROM "session" s JOIN "user" u ON s."userId" = u.id WHERE s.token = ? AND s.expiresAt > ?',
		)
			.bind(sessionToken, now)
			.first<{
				sessionId: string
				expiresAt: number
				uid: string
				name: string
				email: string
				role: string
			}>()

		if (!row) {
			return c.json({ session: null, user: null })
		}

		return c.json({
			session: { id: row.sessionId, token: sessionToken, expiresAt: row.expiresAt },
			user: { id: row.uid, name: row.name, email: row.email, role: row.role ?? 'user' },
		})
	} catch (err) {
		console.error('get-session error:', err)
		return c.json({ error: { message: 'Internal error', code: 'internal_error' } }, 500)
	}
})

export { authRoute }

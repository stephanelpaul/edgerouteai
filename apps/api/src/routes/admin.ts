import { Hono } from 'hono'
import type { AppContext } from '../lib/env.js'
import { adminOnly, superadminOnly } from '../middleware/admin.js'

const adminRoute = new Hono<AppContext>()

// GET /api/admin/users — list all users (admin+)
adminRoute.get('/users', adminOnly, async (c) => {
	const rows = await c.env.DB.prepare(
		'SELECT u.id, u.name, u.email, u.role, u.createdAt FROM "user" u ORDER BY u.createdAt DESC',
	).all()
	return c.json({ users: rows.results })
})

// GET /api/admin/users/:id/stats — get a user's usage stats (admin+)
adminRoute.get('/users/:id/stats', adminOnly, async (c) => {
	const userId = c.req.param('id')
	const stats = await c.env.DB.prepare(
		'SELECT COUNT(*) as totalRequests, COALESCE(SUM(input_tokens),0) as totalInputTokens, COALESCE(SUM(output_tokens),0) as totalOutputTokens, COALESCE(SUM(cost_usd),0) as totalCost FROM request_logs WHERE user_id = ?',
	)
		.bind(userId)
		.first()
	return c.json({ stats })
})

// PUT /api/admin/users/:id/role — change user role (superadmin only)
adminRoute.put('/users/:id/role', superadminOnly, async (c) => {
	const userId = c.req.param('id')
	const { role } = await c.req.json<{ role: string }>()
	if (!['superadmin', 'admin', 'user'].includes(role)) {
		return c.json({ error: { message: 'Invalid role', code: 'validation_error' } }, 400)
	}
	if (userId === c.get('userId')) {
		return c.json(
			{ error: { message: 'Cannot change your own role', code: 'validation_error' } },
			400,
		)
	}
	await c.env.DB.prepare('UPDATE "user" SET role = ?, "updatedAt" = ? WHERE id = ?')
		.bind(role, Date.now(), userId)
		.run()
	return c.json({ success: true })
})

// DELETE /api/admin/users/:id — delete user (superadmin only)
adminRoute.delete('/users/:id', superadminOnly, async (c) => {
	const userId = c.req.param('id')
	if (userId === c.get('userId')) {
		return c.json({ error: { message: 'Cannot delete yourself', code: 'validation_error' } }, 400)
	}
	await c.env.DB.prepare('DELETE FROM session WHERE "userId" = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM account WHERE "userId" = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM api_keys WHERE user_id = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM provider_keys WHERE user_id = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM request_logs WHERE user_id = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM routing_configs WHERE user_id = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM model_aliases WHERE user_id = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM webhooks WHERE user_id = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(userId).run()
	await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()
	return c.json({ success: true })
})

// GET /api/admin/stats — global platform stats (admin+)
adminRoute.get('/stats', adminOnly, async (c) => {
	const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM "user"').first<{
		count: number
	}>()
	const keyCount = await c.env.DB.prepare(
		'SELECT COUNT(*) as count FROM api_keys WHERE revoked_at IS NULL',
	).first<{ count: number }>()
	const requestStats = await c.env.DB.prepare(
		'SELECT COUNT(*) as totalRequests, COALESCE(SUM(cost_usd),0) as totalCost, COALESCE(SUM(input_tokens + output_tokens),0) as totalTokens FROM request_logs',
	).first()
	return c.json({
		users: userCount?.count ?? 0,
		activeKeys: keyCount?.count ?? 0,
		...(requestStats || {}),
	})
})

export { adminRoute }

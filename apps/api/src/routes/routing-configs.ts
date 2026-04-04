import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { createDb, routingConfigs } from '@edgerouteai/db'
import type { AppContext } from '../lib/env.js'

const routingConfigsRoute = new Hono<AppContext>()

routingConfigsRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const configs = await db
    .select()
    .from(routingConfigs)
    .where(eq(routingConfigs.userId, userId))
  return c.json({
    configs: configs.map((cfg) => ({ ...cfg, fallbackChain: JSON.parse(cfg.fallbackChain) })),
  })
})

routingConfigsRoute.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const body = await c.req.json<{
    name: string
    fallbackChain: string[]
    isDefault?: boolean
  }>()
  const id = crypto.randomUUID()
  await db.insert(routingConfigs).values({
    id,
    userId,
    name: body.name,
    fallbackChain: JSON.stringify(body.fallbackChain),
    isDefault: body.isDefault ?? false,
    createdAt: new Date(),
  })
  return c.json({ id, name: body.name }, 201)
})

routingConfigsRoute.put('/:id', async (c) => {
  const configId = c.req.param('id')
  const db = createDb(c.env.DB)
  const body = await c.req.json<{
    name?: string
    fallbackChain?: string[]
    isDefault?: boolean
  }>()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.fallbackChain !== undefined) updates.fallbackChain = JSON.stringify(body.fallbackChain)
  if (body.isDefault !== undefined) updates.isDefault = body.isDefault
  await db.update(routingConfigs).set(updates).where(eq(routingConfigs.id, configId))
  return c.json({ success: true })
})

routingConfigsRoute.delete('/:id', async (c) => {
  const configId = c.req.param('id')
  const db = createDb(c.env.DB)
  await db.delete(routingConfigs).where(eq(routingConfigs.id, configId))
  return c.json({ success: true })
})

export { routingConfigsRoute }

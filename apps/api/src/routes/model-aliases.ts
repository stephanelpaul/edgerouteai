import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb, modelAliases } from '@edgerouteai/db'
import { EdgeRouteError } from '@edgerouteai/shared'
import type { AppContext } from '../lib/env.js'

const modelAliasesRoute = new Hono<AppContext>()

modelAliasesRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const aliases = await db
    .select()
    .from(modelAliases)
    .where(eq(modelAliases.userId, userId))
  return c.json({ aliases })
})

modelAliasesRoute.post('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const body = await c.req.json<{ alias: string; targetModel: string }>()

  if (!body.alias || !body.targetModel) {
    throw new EdgeRouteError('alias and targetModel are required', 'validation_error', 400)
  }

  const id = crypto.randomUUID()
  await db.insert(modelAliases).values({
    id,
    userId,
    alias: body.alias.trim(),
    targetModel: body.targetModel.trim(),
    createdAt: new Date(),
  })

  return c.json({ id, alias: body.alias, targetModel: body.targetModel }, 201)
})

modelAliasesRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const aliasId = c.req.param('id')
  const db = createDb(c.env.DB)

  const result = await db
    .delete(modelAliases)
    .where(and(eq(modelAliases.id, aliasId), eq(modelAliases.userId, userId)))

  return c.json({ success: true })
})

export { modelAliasesRoute }

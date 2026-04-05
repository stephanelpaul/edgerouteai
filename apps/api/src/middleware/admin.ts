import { createMiddleware } from 'hono/factory'
import { EdgeRouteError } from '@edgerouteai/shared'
import type { AppContext } from '../lib/env.js'

export const adminOnly = createMiddleware<AppContext>(async (c, next) => {
  const role = c.get('role')
  if (role !== 'superadmin' && role !== 'admin') {
    throw new EdgeRouteError('Admin access required', 'forbidden', 403)
  }
  return next()
})

export const superadminOnly = createMiddleware<AppContext>(async (c, next) => {
  const role = c.get('role')
  if (role !== 'superadmin') {
    throw new EdgeRouteError('Superadmin access required', 'forbidden', 403)
  }
  return next()
})

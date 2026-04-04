import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb, providerKeys } from '@edgerouteai/db'
import { encrypt, decrypt } from '../lib/crypto.js'
import type { AppContext } from '../lib/env.js'

const providerKeysRoute = new Hono<AppContext>()

providerKeysRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const db = createDb(c.env.DB)
  const keys = await db
    .select({
      id: providerKeys.id,
      provider: providerKeys.provider,
      isValid: providerKeys.isValid,
      lastVerifiedAt: providerKeys.lastVerifiedAt,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId))
  return c.json({ keys })
})

providerKeysRoute.put('/:provider', async (c) => {
  const userId = c.get('userId')
  const provider = c.req.param('provider')
  const body = await c.req.json<{ apiKey: string }>()
  const db = createDb(c.env.DB)
  const { encrypted, iv } = await encrypt(body.apiKey, c.env.ENCRYPTION_KEY)
  await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.userId, userId), eq(providerKeys.provider, provider)))
  await db.insert(providerKeys).values({
    id: crypto.randomUUID(),
    userId,
    provider,
    encryptedKey: new Uint8Array(encrypted),
    iv: new Uint8Array(iv),
    isValid: true,
    createdAt: new Date(),
  })
  return c.json({ success: true, provider })
})

providerKeysRoute.delete('/:provider', async (c) => {
  const userId = c.get('userId')
  const provider = c.req.param('provider')
  const db = createDb(c.env.DB)
  await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.userId, userId), eq(providerKeys.provider, provider)))
  return c.json({ success: true })
})

providerKeysRoute.post('/:provider/verify', async (c) => {
  const userId = c.get('userId')
  const provider = c.req.param('provider')
  const db = createDb(c.env.DB)
  const [pk] = await db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.userId, userId), eq(providerKeys.provider, provider)))
    .limit(1)
  if (!pk) return c.json({ valid: false, error: 'No key found' }, 404)
  const apiKey = await decrypt(
    pk.encryptedKey as unknown as ArrayBuffer,
    pk.iv as unknown as Uint8Array,
    c.env.ENCRYPTION_KEY,
  )
  try {
    const VERIFY_URLS: Record<
      string,
      { url: string; headers: (k: string) => Record<string, string> }
    > = {
      openai: {
        url: 'https://api.openai.com/v1/models',
        headers: (k) => ({ Authorization: `Bearer ${k}` }),
      },
      anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        headers: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' }),
      },
      mistral: {
        url: 'https://api.mistral.ai/v1/models',
        headers: (k) => ({ Authorization: `Bearer ${k}` }),
      },
      xai: {
        url: 'https://api.x.ai/v1/models',
        headers: (k) => ({ Authorization: `Bearer ${k}` }),
      },
    }
    const verifier = VERIFY_URLS[provider]
    if (verifier) {
      const res = await fetch(verifier.url, {
        method: 'GET',
        headers: verifier.headers(apiKey),
      })
      const valid = res.ok || res.status === 405
      await db
        .update(providerKeys)
        .set({ isValid: valid, lastVerifiedAt: new Date() })
        .where(eq(providerKeys.id, pk.id))
      return c.json({ valid })
    }
    return c.json({ valid: true, message: 'Verification not available' })
  } catch {
    await db
      .update(providerKeys)
      .set({ isValid: false, lastVerifiedAt: new Date() })
      .where(eq(providerKeys.id, pk.id))
    return c.json({ valid: false, error: 'Verification failed' })
  }
})

export { providerKeysRoute }

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { resolveRoute, buildFallbackChain, proxyRequest, autoRoute } from '@edgerouteai/core'
import { createDb, providerKeys, routingConfigs, requestLogs } from '@edgerouteai/db'
import {
  ModelNotFoundError,
  ProviderKeyMissingError,
  ProviderError,
  calculateCost,
  type ChatCompletionRequest,
  type ChatCompletionChunk,
} from '@edgerouteai/shared'
import { decrypt } from '../lib/crypto.js'
import type { AppContext } from '../lib/env.js'

const proxy = new Hono<AppContext>()

proxy.post('/v1/chat/completions', async (c) => {
  const userId = c.get('userId')
  const apiKeyId = c.get('apiKeyId')
  const body = await c.req.json<ChatCompletionRequest>()
  const db = createDb(c.env.DB)

  let resolvedModel = body.model
  let autoReason: string | undefined

  // Handle auto-routing
  if (body.model === 'auto' || body.model.startsWith('auto/')) {
    const tierStr = body.model === 'auto' ? undefined : body.model.split('/')[1]
    const tier = (tierStr === 'quality' || tierStr === 'balanced' || tierStr === 'budget')
      ? tierStr
      : undefined

    const userProviderKeys = await db
      .select({ provider: providerKeys.provider })
      .from(providerKeys)
      .where(eq(providerKeys.userId, userId))
    const availableProviders = userProviderKeys.map((pk) => pk.provider)

    if (availableProviders.length === 0) {
      throw new ProviderKeyMissingError('any')
    }

    const autoResult = autoRoute({
      messages: body.messages,
      availableProviders,
      tier,
    })

    if (!autoResult) {
      throw new ModelNotFoundError('auto (no compatible model found)')
    }

    resolvedModel = `${autoResult.provider}/${autoResult.modelId}`
    autoReason = autoResult.reason
  }

  const primaryRoute = resolveRoute(resolvedModel)
  if (!primaryRoute) throw new ModelNotFoundError(resolvedModel)

  const [config] = await db
    .select()
    .from(routingConfigs)
    .where(eq(routingConfigs.userId, userId))
    .limit(1)
  const fallbackModels: string[] = config ? JSON.parse(config.fallbackChain) : []
  const chain = buildFallbackChain(resolvedModel, fallbackModels)

  let lastError: Error | null = null

  for (const route of chain) {
    const allProviderKeys = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.userId, userId))
    const [pk] = allProviderKeys.filter((r) => r.provider === route.provider)
    if (!pk) {
      lastError = new ProviderKeyMissingError(route.provider)
      continue
    }

    const apiKey = await decrypt(
      pk.encryptedKey as unknown as ArrayBuffer,
      pk.iv as unknown as Uint8Array,
      c.env.ENCRYPTION_KEY,
    )

    try {
      const startTime = Date.now()
      const result = await proxyRequest({
        request: body,
        adapter: route.adapter,
        modelId: route.modelId,
        apiKey,
      })

      c.executionCtx.waitUntil(
        (async () => {
          const reader = result.logStream.getReader()
          const decoder = new TextDecoder()
          const chunks: ChatCompletionChunk[] = []
          let rawText = ''
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              rawText += decoder.decode(value, { stream: true })
            }
            const lines = rawText.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6).trim()
                const chunk = route.adapter.transformStreamChunk(data)
                if (chunk) chunks.push(chunk)
              }
            }
            const usage = route.adapter.extractUsageFromChunks(chunks)
            const latencyMs = Date.now() - startTime
            const modelString = `${route.provider}/${route.modelId}`
            const costUsd = calculateCost(modelString, usage.prompt_tokens, usage.completion_tokens)

            await db.insert(requestLogs).values({
              id: crypto.randomUUID(),
              userId,
              apiKeyId,
              provider: route.provider,
              model: route.modelId,
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
              costUsd,
              latencyMs,
              statusCode: 200,
              createdAt: new Date(),
            })
          } catch (err) {
            console.error('Background logging error:', err)
          }
        })(),
      )

      const responseHeaders: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-EdgeRoute-Provider': route.provider,
        'X-EdgeRoute-Model': route.modelId,
      }
      if (autoReason) {
        responseHeaders['X-EdgeRoute-Auto-Reason'] = autoReason
      }
      return new Response(result.stream, { headers: responseHeaders })
    } catch (err) {
      lastError = err as Error
      if (err instanceof ProviderError && [429, 500, 503].includes(err.status)) continue
      throw err
    }
  }

  if (lastError) throw lastError
  throw new ModelNotFoundError(body.model)
})

export { proxy }

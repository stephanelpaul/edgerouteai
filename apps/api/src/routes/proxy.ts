import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { resolveRoute, buildFallbackChain, proxyRequest, autoRoute } from '@edgerouteai/core'
import { createDb, providerKeys, routingConfigs, requestLogs, modelAliases, budgets } from '@edgerouteai/db'
import {
  ModelNotFoundError,
  ProviderKeyMissingError,
  ProviderError,
  EdgeRouteError,
  calculateCost,
  type ChatCompletionRequest,
  type ChatCompletionChunk,
} from '@edgerouteai/shared'
import { decrypt } from '../lib/crypto.js'
import type { AppContext } from '../lib/env.js'

const proxy = new Hono<AppContext>()

async function hashRequest(req: ChatCompletionRequest): Promise<string> {
  const key = JSON.stringify({
    model: req.model,
    messages: req.messages,
    temperature: req.temperature,
    max_tokens: req.max_tokens,
  })
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

proxy.post('/v1/chat/completions', async (c) => {
  const userId = c.get('userId')
  const apiKeyId = c.get('apiKeyId')
  const body = await c.req.json<ChatCompletionRequest>()
  const db = createDb(c.env.DB)

  let resolvedModel = body.model
  let autoReason: string | undefined

  // Check for model alias
  const [alias] = await db
    .select()
    .from(modelAliases)
    .where(and(eq(modelAliases.userId, userId), eq(modelAliases.alias, body.model)))
    .limit(1)
  if (alias) {
    resolvedModel = alias.targetModel
  }

  // Handle auto-routing
  if (resolvedModel === 'auto' || resolvedModel.startsWith('auto/')) {
    const tierStr = resolvedModel === 'auto' ? undefined : resolvedModel.split('/')[1]
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

  // Check budget
  let budget: typeof budgets.$inferSelect | undefined
  const [budgetRow] = await db
    .select()
    .from(budgets)
    .where(eq(budgets.apiKeyId, apiKeyId))
    .limit(1)

  if (budgetRow) {
    const now = new Date()
    const periodStart = new Date(budgetRow.periodStart)

    if (
      now.getMonth() !== periodStart.getMonth() ||
      now.getFullYear() !== periodStart.getFullYear()
    ) {
      // Reset for new month
      await db
        .update(budgets)
        .set({ currentSpendUsd: 0, periodStart: now, isDisabled: false })
        .where(eq(budgets.id, budgetRow.id))
      budget = { ...budgetRow, currentSpendUsd: 0, isDisabled: false, periodStart: now }
    } else if (budgetRow.isDisabled || budgetRow.currentSpendUsd >= budgetRow.monthlyLimitUsd) {
      throw new EdgeRouteError('Monthly budget limit exceeded for this API key', 'budget_exceeded', 429)
    } else {
      budget = budgetRow
    }
  }

  // Cache check (only for streaming requests)
  const cacheKey = `cache:${userId}:${await hashRequest({ ...body, model: resolvedModel })}`
  if (body.stream !== false && c.env.CACHE) {
    const cached = await c.env.CACHE.get(cacheKey)
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-EdgeRoute-Cache': 'HIT',
        },
      })
    }
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

            // Update budget spend
            if (budget) {
              const newSpend = budget.currentSpendUsd + (costUsd ?? 0)
              await db
                .update(budgets)
                .set({
                  currentSpendUsd: newSpend,
                  isDisabled: newSpend >= budget.monthlyLimitUsd,
                })
                .where(eq(budgets.id, budget.id))
            }

            // Store in cache (only for streaming responses with successful content)
            if (body.stream !== false && rawText && c.env.CACHE) {
              await c.env.CACHE.put(cacheKey, rawText, { expirationTtl: 3600 })
            }
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
        'X-EdgeRoute-Cache': 'MISS',
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

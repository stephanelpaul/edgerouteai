import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { resolveRoute, buildFallbackChain, proxyRequest, autoRoute } from '@edgerouteai/core'
import {
  createDb,
  providerKeys,
  routingConfigs,
  requestLogs,
  modelAliases,
  budgets,
  webhooks,
  requestTransforms,
} from '@edgerouteai/db'
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

async function hmacSign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  timeoutMs: number,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const result = await fn()
        clearTimeout(timer)
        return result
      } catch (err) {
        clearTimeout(timer)
        throw err
      }
    } catch (err: any) {
      const isRetryable = err?.status && [429, 500, 502, 503].includes(err.status)
      const isTimeout = err?.name === 'AbortError'
      if ((isRetryable || isTimeout) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  throw new Error('Retry exhausted')
}

proxy.post('/v1/chat/completions', async (c) => {
  const userId = c.get('userId')
  const apiKeyId = c.get('apiKeyId')
  const retryCount = c.get('retryCount')
  const timeoutMs = c.get('timeoutMs')
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
    const tier = tierStr === 'quality' || tierStr === 'balanced' || tierStr === 'budget'
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

  // Cache check (only for non-streaming requests)
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

  // Apply request transforms (only when authenticated with a real API key)
  if (apiKeyId !== 'session') {
    const transforms = await db
      .select()
      .from(requestTransforms)
      .where(and(eq(requestTransforms.apiKeyId, apiKeyId), eq(requestTransforms.isActive, true)))

    for (const transform of transforms) {
      if (transform.type === 'prepend_system') {
        body.messages = [{ role: 'system', content: transform.value }, ...body.messages]
      } else if (transform.type === 'append_system') {
        const systemIdx = body.messages.findIndex((m) => m.role === 'system')
        if (systemIdx >= 0) {
          const existing = body.messages[systemIdx].content
          body.messages[systemIdx] = {
            ...body.messages[systemIdx],
            content: existing + '\n' + transform.value,
          }
        } else {
          body.messages = [{ role: 'system', content: transform.value }, ...body.messages]
        }
      } else if (transform.type === 'set_parameter') {
        const params = JSON.parse(transform.value)
        for (const [key, val] of Object.entries(params)) {
          if ((body as any)[key] === undefined) {
            ;(body as any)[key] = val
          }
        }
      }
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
    const providerKeysList = allProviderKeys.filter((r) => r.provider === route.provider)
    if (providerKeysList.length === 0) {
      lastError = new ProviderKeyMissingError(route.provider)
      continue
    }
    // Load balance: random selection distributes load across multiple keys
    const keyIndex = Math.floor(Math.random() * providerKeysList.length)
    const pk = providerKeysList[keyIndex]

    const apiKey = await decrypt(
      pk.encryptedKey as unknown as ArrayBuffer,
      pk.iv as unknown as Uint8Array,
      c.env.ENCRYPTION_KEY,
    )

    try {
      const startTime = Date.now()
      const result = await withRetry(
        () =>
          proxyRequest({
            request: body,
            adapter: route.adapter,
            modelId: route.modelId,
            apiKey,
          }),
        retryCount,
        timeoutMs,
      )

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

              // Fire budget.exceeded webhook if limit just hit
              if (newSpend >= budget.monthlyLimitUsd) {
                const userWebhooks = await db
                  .select()
                  .from(webhooks)
                  .where(and(eq(webhooks.userId, userId), eq(webhooks.isActive, true)))
                const budgetEvent = {
                  event: 'budget.exceeded',
                  data: {
                    apiKeyId,
                    monthlyLimitUsd: budget.monthlyLimitUsd,
                    currentSpendUsd: newSpend,
                    timestamp: new Date().toISOString(),
                  },
                }
                for (const wh of userWebhooks) {
                  const events = JSON.parse(wh.events)
                  if (events.includes('budget.exceeded')) {
                    const whBody = JSON.stringify(budgetEvent)
                    const signature = wh.secret ? await hmacSign(whBody, wh.secret) : undefined
                    fetch(wh.url, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(signature ? { 'X-EdgeRoute-Signature': signature } : {}),
                      },
                      body: whBody,
                    }).catch(() => {})
                  }
                }
              }
            }

            // Store in cache (only for streaming responses with successful content)
            if (body.stream !== false && rawText && c.env.CACHE) {
              await c.env.CACHE.put(cacheKey, rawText, { expirationTtl: 3600 })
            }

            // Fire request.completed webhooks
            const userWebhooks = await db
              .select()
              .from(webhooks)
              .where(and(eq(webhooks.userId, userId), eq(webhooks.isActive, true)))
            const requestEvent = {
              event: 'request.completed',
              data: {
                model: route.modelId,
                provider: route.provider,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
                costUsd,
                latencyMs,
                timestamp: new Date().toISOString(),
              },
            }
            for (const wh of userWebhooks) {
              const events = JSON.parse(wh.events)
              if (events.includes('request.completed')) {
                const whBody = JSON.stringify(requestEvent)
                const signature = wh.secret ? await hmacSign(whBody, wh.secret) : undefined
                fetch(wh.url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(signature ? { 'X-EdgeRoute-Signature': signature } : {}),
                  },
                  body: whBody,
                }).catch(() => {})
              }
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

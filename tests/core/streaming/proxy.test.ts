import { describe, it, expect, vi } from 'vitest'
import { proxyRequest } from '@edgerouteai/core/streaming/proxy'
import type { ChatCompletionRequest } from '@edgerouteai/shared'
import { openaiAdapter } from '@edgerouteai/core/adapters/openai'

describe('proxyRequest', () => {
  it('sends request to provider and returns streaming response', async () => {
    const sseBody = 'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\ndata: [DONE]\n\n'
    const mockFetch = vi.fn().mockResolvedValue(new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))

    const req: ChatCompletionRequest = { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }], stream: true }
    const result = await proxyRequest({ request: req, adapter: openaiAdapter, modelId: 'gpt-4o', apiKey: 'sk-test', fetchFn: mockFetch })

    expect(result.stream).toBeDefined()
    expect(result.logStream).toBeDefined()
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('throws ProviderError on non-2xx response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('{"error":{"message":"Invalid key"}}', { status: 401 }))
    const req: ChatCompletionRequest = { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }], stream: true }

    await expect(proxyRequest({ request: req, adapter: openaiAdapter, modelId: 'gpt-4o', apiKey: 'sk-bad', fetchFn: mockFetch })).rejects.toThrow()
  })
})

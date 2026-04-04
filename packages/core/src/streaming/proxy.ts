import type { ChatCompletionRequest } from '@edgerouteai/shared'
import { ProviderError } from '@edgerouteai/shared'
import type { ProviderAdapter } from '../adapters/types.js'
import { teeStream } from './tee.js'

export interface ProxyRequestOptions {
  request: ChatCompletionRequest
  adapter: ProviderAdapter
  modelId: string
  apiKey: string
  fetchFn?: typeof fetch
}

export interface ProxyResult {
  stream: ReadableStream<Uint8Array>
  logStream: ReadableStream<Uint8Array>
  provider: string
  model: string
}

export async function proxyRequest(options: ProxyRequestOptions): Promise<ProxyResult> {
  const { request, adapter, modelId, apiKey, fetchFn = fetch } = options
  const providerReq = adapter.transformRequest({ ...request, model: modelId }, apiKey)

  const response = await fetchFn(providerReq.url, {
    method: 'POST',
    headers: providerReq.headers,
    body: providerReq.body,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new ProviderError(adapter.id, `Provider ${adapter.id} returned ${response.status}: ${errorBody}`, response.status)
  }

  if (!response.body) {
    throw new ProviderError(adapter.id, 'No response body from provider', 502)
  }

  const [clientStream, logStream] = teeStream(response.body)
  return { stream: clientStream, logStream, provider: adapter.id, model: modelId }
}

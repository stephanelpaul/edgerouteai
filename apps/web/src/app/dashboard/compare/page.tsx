'use client'
import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

interface ModelConfig {
  id: string
  provider: string
  name: string
}

const MODELS: Record<string, ModelConfig> = {
  'openai/gpt-5': { id: 'gpt-5', provider: 'openai', name: 'GPT-5' },
  'openai/gpt-5.4': { id: 'gpt-5.4', provider: 'openai', name: 'GPT-5.4' },
  'openai/gpt-4o': { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o' },
  'openai/gpt-4.1': { id: 'gpt-4.1', provider: 'openai', name: 'GPT-4.1' },
  'openai/o3': { id: 'o3', provider: 'openai', name: 'o3' },
  'openai/o4-mini': { id: 'o4-mini', provider: 'openai', name: 'o4-mini' },
  'anthropic/claude-opus-4-6': { id: 'claude-opus-4-6', provider: 'anthropic', name: 'Claude Opus 4.6' },
  'anthropic/claude-sonnet-4-6': { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6' },
  'anthropic/claude-sonnet-4-5': { id: 'claude-sonnet-4-5', provider: 'anthropic', name: 'Claude Sonnet 4.5' },
  'anthropic/claude-haiku-4-5': { id: 'claude-haiku-4-5', provider: 'anthropic', name: 'Claude Haiku 4.5' },
  'google/gemini-2.5-pro': { id: 'gemini-2.5-pro-preview-03-25', provider: 'google', name: 'Gemini 2.5 Pro' },
  'google/gemini-2.5-flash': { id: 'gemini-2.5-flash-preview-04-17', provider: 'google', name: 'Gemini 2.5 Flash' },
  'google/gemini-2.5-flash-lite': { id: 'gemini-2.5-flash-lite', provider: 'google', name: 'Gemini 2.5 Flash Lite' },
  'mistral/mistral-large': { id: 'mistral-large-latest', provider: 'mistral', name: 'Mistral Large 3' },
  'mistral/mistral-medium': { id: 'mistral-medium-latest', provider: 'mistral', name: 'Mistral Medium 3' },
  'mistral/mistral-small': { id: 'mistral-small-latest', provider: 'mistral', name: 'Mistral Small 3.1' },
  'xai/grok-4.20': { id: 'grok-4.20', provider: 'xai', name: 'Grok 4.20' },
}

const MODEL_KEYS = Object.keys(MODELS)

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
  xai: 'xAI',
}

function getModelLabel(key: string) {
  const m = MODELS[key]
  if (!m) return key
  return `${PROVIDER_LABELS[m.provider] ?? m.provider} / ${m.name}`
}

const MODEL_GROUPS = MODEL_KEYS.reduce<Record<string, string[]>>((acc, key) => {
  const p = MODELS[key].provider
  if (!acc[p]) acc[p] = []
  acc[p].push(key)
  return acc
}, {})

interface ModelResult {
  modelKey: string
  content: string
  done: boolean
  latencyMs?: number
  error?: string
}

export default function ComparePage() {
  const { apiKey, apiUrl } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([
    MODEL_KEYS[0],
    MODEL_KEYS[7], // claude-opus-4-6
  ])
  const [results, setResults] = useState<ModelResult[]>([])
  const [comparing, setComparing] = useState(false)
  const abortControllers = useRef<AbortController[]>([])

  const setModel = (index: number, modelKey: string) => {
    setSelectedModels((prev) => {
      const next = [...prev]
      next[index] = modelKey
      return next
    })
  }

  const addModel = () => {
    if (selectedModels.length >= 4) return
    // Find a model not already selected
    const available = MODEL_KEYS.find((k) => !selectedModels.includes(k))
    if (available) setSelectedModels((prev) => [...prev, available])
  }

  const removeModel = (index: number) => {
    if (selectedModels.length <= 2) return
    setSelectedModels((prev) => prev.filter((_, i) => i !== index))
  }

  const stopAll = () => {
    abortControllers.current.forEach((c) => c.abort())
    abortControllers.current = []
    setComparing(false)
  }

  const runComparison = useCallback(async () => {
    if (!prompt.trim() || comparing || !apiKey) return
    setComparing(true)

    // Initialize results
    const initialResults: ModelResult[] = selectedModels.map((modelKey) => ({
      modelKey,
      content: '',
      done: false,
    }))
    setResults(initialResults)

    const controllers = selectedModels.map(() => new AbortController())
    abortControllers.current = controllers

    const startTimes = selectedModels.map(() => Date.now())

    const streamModel = async (modelKey: string, index: number) => {
      const controller = controllers[index]
      const startTime = startTimes[index]
      try {
        const response = await fetch(`${apiUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelKey,
            messages: [{ role: 'user', content: prompt.trim() }],
            stream: true,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }))
          const msg = (data as any)?.error?.message ?? `HTTP ${response.status}`
          setResults((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], error: msg, done: true }
            return next
          })
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          setResults((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], error: 'No response body', done: true }
            return next
          })
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let content = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed?.choices?.[0]?.delta?.content
              if (typeof delta === 'string') {
                content += delta
                setResults((prev) => {
                  const next = [...prev]
                  next[index] = { ...next[index], content }
                  return next
                })
              }
            } catch {
              // skip malformed
            }
          }
        }

        const latencyMs = Date.now() - startTime
        setResults((prev) => {
          const next = [...prev]
          next[index] = { ...next[index], content, done: true, latencyMs }
          return next
        })
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setResults((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], done: true }
            return next
          })
        } else {
          setResults((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], error: err.message ?? 'Unknown error', done: true }
            return next
          })
        }
      }
    }

    await Promise.all(selectedModels.map((modelKey, i) => streamModel(modelKey, i)))
    setComparing(false)
    abortControllers.current = []
  }, [prompt, comparing, apiKey, apiUrl, selectedModels])

  if (!apiKey) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400">Connect your API key to use model comparison.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
          >
            Connect API Key
          </Link>
        </div>
      </div>
    )
  }

  const allDone = results.length > 0 && results.every((r) => r.done)

  return (
    <div className="flex flex-col h-full -m-8">
      {/* Header */}
      <div className="border-b border-neutral-800 px-6 py-4 bg-neutral-950 shrink-0">
        <h1 className="text-lg font-semibold">Model Comparison</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Send the same prompt to multiple models simultaneously.</p>
      </div>

      {/* Prompt + model selectors */}
      <div className="border-b border-neutral-800 bg-neutral-950 px-6 py-4 shrink-0 space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt to send to all selected models..."
          rows={3}
          disabled={comparing}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-purple-500 focus:outline-none resize-none disabled:opacity-50"
        />

        {/* Model selectors row */}
        <div className="flex items-center gap-3 flex-wrap">
          {selectedModels.map((modelKey, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={modelKey}
                onChange={(e) => setModel(i, e.target.value)}
                disabled={comparing}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50 cursor-pointer"
              >
                {Object.entries(MODEL_GROUPS).map(([provider, keys]) => (
                  <optgroup key={provider} label={PROVIDER_LABELS[provider] ?? provider}>
                    {keys.map((key) => (
                      <option key={key} value={key}>{getModelLabel(key)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selectedModels.length > 2 && (
                <button
                  onClick={() => removeModel(i)}
                  disabled={comparing}
                  className="text-neutral-600 hover:text-neutral-400 transition text-lg leading-none disabled:opacity-50"
                  title="Remove model"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {selectedModels.length < 4 && (
            <button
              onClick={addModel}
              disabled={comparing}
              className="rounded-lg border border-dashed border-neutral-700 px-3 py-1.5 text-sm text-neutral-500 hover:border-neutral-500 hover:text-neutral-300 transition disabled:opacity-50"
            >
              + Add Model
            </button>
          )}

          <div className="ml-auto flex gap-2">
            {comparing ? (
              <button
                onClick={stopAll}
                className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 transition"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={runComparison}
                disabled={!prompt.trim()}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Compare
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results grid */}
      <div className="flex-1 overflow-auto">
        {results.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-neutral-600 text-sm">Select models and enter a prompt to compare.</p>
          </div>
        )}
        {results.length > 0 && (
          <div
            className="grid h-full"
            style={{ gridTemplateColumns: `repeat(${results.length}, minmax(0, 1fr))` }}
          >
            {results.map((result, i) => {
              const model = MODELS[result.modelKey]
              return (
                <div key={i} className={`flex flex-col border-r border-neutral-800 last:border-r-0`}>
                  {/* Column header */}
                  <div className="border-b border-neutral-800 px-4 py-2.5 bg-neutral-900/50 shrink-0">
                    <p className="text-xs font-medium text-neutral-200">
                      {model ? `${PROVIDER_LABELS[model.provider] ?? model.provider} / ${model.name}` : result.modelKey}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!result.done && comparing && (
                        <span className="flex items-center gap-1 text-xs text-purple-400">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          Streaming
                        </span>
                      )}
                      {result.done && result.latencyMs && (
                        <span className="text-xs text-neutral-500">{result.latencyMs}ms</span>
                      )}
                      {result.error && (
                        <span className="text-xs text-red-400">Error</span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {result.error ? (
                      <p className="text-sm text-red-400">{result.error}</p>
                    ) : (
                      <p className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
                        {result.content}
                        {!result.done && comparing && result.content && (
                          <span className="inline-block w-1.5 h-4 ml-0.5 bg-neutral-400 animate-pulse align-middle" />
                        )}
                        {!result.content && !result.error && (
                          <span className="text-neutral-600">Waiting for response...</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary bar after all complete */}
      {allDone && results.length > 0 && (
        <div className="border-t border-neutral-800 bg-neutral-900/50 px-6 py-3 shrink-0">
          <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">Latency Comparison</p>
          <div className="flex gap-6">
            {results.map((result, i) => {
              const model = MODELS[result.modelKey]
              const label = model ? `${PROVIDER_LABELS[model.provider] ?? model.provider} / ${model.name}` : result.modelKey
              const fastest = Math.min(...results.filter((r) => r.latencyMs).map((r) => r.latencyMs!))
              const isFastest = result.latencyMs === fastest && !result.error
              return (
                <div key={i} className="text-xs">
                  <span className="text-neutral-400">{label}: </span>
                  <span className={isFastest ? 'text-green-400 font-medium' : 'text-neutral-200'}>
                    {result.error ? 'Error' : result.latencyMs ? `${result.latencyMs}ms` : '—'}
                    {isFastest && ' (fastest)'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

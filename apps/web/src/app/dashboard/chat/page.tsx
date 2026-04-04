'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ModelConfig {
  id: string
  provider: string
  name: string
  contextLength: number
}

const AUTO_OPTIONS: { id: string; label: string }[] = [
  { id: 'auto', label: 'Auto (Balanced)' },
  { id: 'auto/quality', label: 'Auto (Quality)' },
  { id: 'auto/budget', label: 'Auto (Budget)' },
]

const MODELS: Record<string, ModelConfig> = {
  // OpenAI
  'openai/gpt-5.4': { id: 'gpt-5.4', provider: 'openai', name: 'GPT-5.4', contextLength: 1047576 },
  'openai/gpt-5.4-mini': { id: 'gpt-5.4-mini', provider: 'openai', name: 'GPT-5.4 Mini', contextLength: 1047576 },
  'openai/gpt-5.2': { id: 'gpt-5.2', provider: 'openai', name: 'GPT-5.2', contextLength: 1047576 },
  'openai/gpt-5': { id: 'gpt-5', provider: 'openai', name: 'GPT-5', contextLength: 1047576 },
  'openai/gpt-4o': { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', contextLength: 128000 },
  'openai/gpt-4.1': { id: 'gpt-4.1', provider: 'openai', name: 'GPT-4.1', contextLength: 1047576 },
  'openai/o3': { id: 'o3', provider: 'openai', name: 'o3', contextLength: 200000 },
  'openai/o4-mini': { id: 'o4-mini', provider: 'openai', name: 'o4-mini', contextLength: 200000 },
  // Anthropic
  'anthropic/claude-opus-4-6': { id: 'claude-opus-4-6', provider: 'anthropic', name: 'Claude Opus 4.6', contextLength: 1000000 },
  'anthropic/claude-sonnet-4-6': { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', contextLength: 1000000 },
  'anthropic/claude-sonnet-4-5': { id: 'claude-sonnet-4-5', provider: 'anthropic', name: 'Claude Sonnet 4.5', contextLength: 200000 },
  'anthropic/claude-haiku-4-5': { id: 'claude-haiku-4-5', provider: 'anthropic', name: 'Claude Haiku 4.5', contextLength: 200000 },
  // Google
  'google/gemini-2.5-pro': { id: 'gemini-2.5-pro-preview-03-25', provider: 'google', name: 'Gemini 2.5 Pro', contextLength: 1048576 },
  'google/gemini-2.5-flash': { id: 'gemini-2.5-flash-preview-04-17', provider: 'google', name: 'Gemini 2.5 Flash', contextLength: 1048576 },
  'google/gemini-2.5-flash-lite': { id: 'gemini-2.5-flash-lite', provider: 'google', name: 'Gemini 2.5 Flash Lite', contextLength: 1048576 },
  // Mistral
  'mistral/mistral-large': { id: 'mistral-large-latest', provider: 'mistral', name: 'Mistral Large 3', contextLength: 131072 },
  'mistral/mistral-medium': { id: 'mistral-medium-latest', provider: 'mistral', name: 'Mistral Medium 3', contextLength: 131072 },
  'mistral/mistral-small': { id: 'mistral-small-latest', provider: 'mistral', name: 'Mistral Small 3.1', contextLength: 131072 },
  // xAI
  'xai/grok-4.20': { id: 'grok-4.20', provider: 'xai', name: 'Grok 4.20', contextLength: 131072 },
}

const MODEL_KEYS = Object.keys(MODELS)

function capitalizeProvider(provider: string): string {
  const map: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    mistral: 'Mistral',
    xai: 'xAI',
  }
  return map[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
}

function getModelLabel(key: string): string {
  const model = MODELS[key as keyof typeof MODELS]
  if (!model) return key
  return `${capitalizeProvider(model.provider)} / ${model.name}`
}

// Group model keys by provider
const MODEL_GROUPS = MODEL_KEYS.reduce<Record<string, string[]>>((acc, key) => {
  const provider = MODELS[key as keyof typeof MODELS].provider
  if (!acc[provider]) acc[provider] = []
  acc[provider].push(key)
  return acc
}, {})

export default function ChatPage() {
  const { apiKey, apiUrl } = useAuth()
  const [selectedModel, setSelectedModel] = useState<string>(MODEL_KEYS[0])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [systemOpen, setSystemOpen] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * 4 + 16
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }, [])

  useEffect(() => {
    adjustTextarea()
  }, [input, adjustTextarea])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || !apiKey) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages([...newMessages, { role: 'assistant', content: '' }])
    setInput('')
    setError(null)
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const chatMessages = systemPrompt.trim()
      ? [{ role: 'system', content: systemPrompt.trim() }, ...newMessages]
      : newMessages

    try {
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: chatMessages,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }))
        const msg = data?.error?.message ?? data?.message ?? `HTTP ${response.status}`
        throw new Error(msg)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let assistantContent = ''

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
              assistantContent += delta
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                return updated
              })
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // user cancelled — keep partial content
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        // Remove the empty assistant message on error
        setMessages((prev) => {
          const updated = [...prev]
          if (updated[updated.length - 1]?.role === 'assistant' && !updated[updated.length - 1].content) {
            return updated.slice(0, -1)
          }
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, apiKey, apiUrl, selectedModel, messages, systemPrompt])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!apiKey) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400">Connect your API key to use the chat playground.</p>
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

  return (
    <div className="flex flex-col h-full -m-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4 bg-neutral-950">
        <h1 className="text-lg font-semibold">Chat Playground</h1>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={isStreaming}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50 cursor-pointer"
        >
          <optgroup label="Auto">
            {AUTO_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </optgroup>
          {Object.entries(MODEL_GROUPS).map(([provider, keys]) => (
            <optgroup key={provider} label={capitalizeProvider(provider)}>
              {keys.map((key) => (
                <option key={key} value={key}>
                  {getModelLabel(key)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* System prompt collapsible */}
      <div className="border-b border-neutral-800 bg-neutral-950 px-6">
        <button
          onClick={() => setSystemOpen((v) => !v)}
          className="flex items-center gap-2 py-3 text-sm text-neutral-400 hover:text-white transition"
        >
          <span className={`transition-transform ${systemOpen ? 'rotate-90' : ''}`}>▶</span>
          System Prompt
          {systemPrompt && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-purple-500" />}
        </button>
        {systemOpen && (
          <div className="pb-3">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter a system prompt (optional)..."
              rows={3}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-purple-500 focus:outline-none resize-none"
            />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between border-b border-red-900 bg-red-950/50 px-6 py-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-lg leading-none">×</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-neutral-600 text-sm">Send a message to start a conversation.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : 'bg-neutral-800 text-neutral-100 rounded-bl-sm'
              }`}
            >
              {msg.content}
              {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-neutral-400 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-neutral-800 bg-neutral-950 px-6 py-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Message..."
            rows={1}
            className="flex-1 resize-none overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm placeholder:text-neutral-600 focus:border-purple-500 focus:outline-none disabled:opacity-50"
            style={{ minHeight: '48px' }}
          />
          {isStreaming ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="rounded-xl bg-neutral-700 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-600 transition whitespace-nowrap"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-500 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-600">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  )
}

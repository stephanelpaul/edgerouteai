import { describe, it, expect } from 'vitest'
import { buildFallbackChain } from '@edgerouteai/core/router/fallback'

describe('Fallback Chain', () => {
  it('builds chain from primary + fallback list', () => {
    const chain = buildFallbackChain('openai/gpt-4o', ['anthropic/claude-sonnet-4-6', 'google/gemini-2.5-pro-preview-03-25'])
    expect(chain).toHaveLength(3)
    expect(chain[0].provider).toBe('openai')
    expect(chain[1].provider).toBe('anthropic')
    expect(chain[2].provider).toBe('google')
  })

  it('returns single-item chain when no fallbacks', () => {
    const chain = buildFallbackChain('openai/gpt-4o', [])
    expect(chain).toHaveLength(1)
  })

  it('skips unresolvable models in fallback list', () => {
    const chain = buildFallbackChain('openai/gpt-4o', ['unknown/bad-model', 'anthropic/claude-sonnet-4-6'])
    expect(chain).toHaveLength(2)
  })

  it('returns empty chain if primary is unresolvable', () => {
    expect(buildFallbackChain('unknown/bad', [])).toHaveLength(0)
  })
})

import { resolveRoute, type ResolvedRoute } from './resolver.js'

export function buildFallbackChain(primaryModel: string, fallbackModels: string[]): ResolvedRoute[] {
  const chain: ResolvedRoute[] = []
  const primary = resolveRoute(primaryModel)
  if (!primary) return chain
  chain.push(primary)
  for (const model of fallbackModels) {
    const route = resolveRoute(model)
    if (route) chain.push(route)
  }
  return chain
}

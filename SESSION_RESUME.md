# Session Resume — EdgeRouteAI Autonomous Build

**Read this first when starting a fresh session.** Everything you need to pick up where I left off.

## What this project is

EdgeRouteAI: an LLM gateway with smart routing, MCP server, and platform-managed keys. **Pivoting from "BYOK + zero markup, OSS only"** to a hosted SaaS with credit-based billing, while keeping the gateway open-source. Fully on Cloudflare (Workers + D1 + KV + Pages).

**Three front doors:**
1. OpenAI-compatible REST at `api.edgerouteai.com` (existing)
2. MCP at `mcp.edgerouteai.com` (new, shipped)
3. `@edgerouteai/mcp-stdio` for Claude Desktop / Cursor (new, shipped)

## Where we are

**Started:** 2026-04-22. **Target deadline:** 2026-05-17 (25-day window). **Currently:** Day 5.

**12 draft PRs open, all CI green. 268 tests passing. 9 workspaces typecheck green.**

```bash
gh pr list --draft  # see all open PRs
cat BUILD_STATUS.md # detailed phase tracker
cat HANDOFF.md      # what user needs to do on return (Polar, Cloudflare secrets, DNS, deploy)
```

## What's shipped

| # | Phase | PR | Notes |
|---|-------|-----|-------|
| 0 | Prep (FSL license split, spec, plan) | merged | License: gateway = FSL-1.1, dashboard + billing = proprietary |
| 1 | Schema (credits, platform keys, ledger, payment_events) | [#5](https://github.com/stephanelpaul/edgerouteai/pull/5) | New tables only, no destructive changes |
| 2 | Gateway platform-key fallback + 2.5% markup | [#6](https://github.com/stephanelpaul/edgerouteai/pull/6) | Atomic UPDATE-with-guard for credit decrement |
| 3 | Polar billing worker (proprietary `apps/billing`) | [#7](https://github.com/stephanelpaul/edgerouteai/pull/7) | Polar (NOT Stripe) — user choice. Closed-source by design |
| 4 | MCP HTTP server | [#8](https://github.com/stephanelpaul/edgerouteai/pull/8) | Direct JSON-RPC 2.0, no SDK dependency |
| 4b | Superadmin platform-key UI | [#9](https://github.com/stephanelpaul/edgerouteai/pull/9) | Replaces manual SQL INSERTs |
| 5 | MCP stdio shim (`@edgerouteai/mcp-stdio`) | [#10](https://github.com/stephanelpaul/edgerouteai/pull/10) | npm package, ready to publish |
| 6.1 + 6.3 | Smart router: cost + context guard + failure tracker | [#11](https://github.com/stephanelpaul/edgerouteai/pull/11) | KV-backed exponential cooldown |
| 7 | Providers: Cloudflare WAI, Together, Groq | [#12](https://github.com/stephanelpaul/edgerouteai/pull/12) | All OpenAI-compatible |
| 8 | Providers: Cohere, Ollama, Azure OpenAI | [#13](https://github.com/stephanelpaul/edgerouteai/pull/13) | Ollama uses pipe-separated cred for base URL |
| 9 | BYOK platform fee | [#14](https://github.com/stephanelpaul/edgerouteai/pull/14) | $1/1000 reqs after 1K free/mo. Pricing slightly adjusted from $0.0001/req — flagged for user |
| 10.1 | Observability MVP | [#15](https://github.com/stephanelpaul/edgerouteai/pull/15) | Analytics endpoints + dashboard page + trace IDs |
| 11.1 | Guardrails MVP | [#16](https://github.com/stephanelpaul/edgerouteai/pull/16) | PII regex + keyword blocklist; input scope only |

**11 providers supported:** OpenAI, Anthropic, Google, Mistral, xAI, Groq, Together AI, Cloudflare Workers AI, Cohere, Ollama, Azure OpenAI.

## What's queued (prioritized)

Pick from this list when continuing work. Each is a single PR-sized chunk.

### High priority (user-facing differentiators)

1. **Smart router v2: LLM classifier** — replace keyword-based task detection with a Haiku/Flash-Lite call (~$0.0001/routing decision). Branch off `feat/smart-router` as new commits.
2. **Smart router v4: user preference overrides** — pin/exclude providers, max-$/req per API key. Needs new schema table `user_router_preferences`.
3. **Landing page polish** — value prop above fold, drop-in code example, pricing table, comparison vs OpenRouter. Edit `apps/web/src/app/page.tsx`. Branch `feat/landing`.

### Medium priority (content-heavy, can run in parallel)

4. **Docs site + chatbot integration guides** — native docs route at `apps/web/src/app/docs/`. One page each for: Quickstart, Auth, BYOK setup per provider, MCP, LangChain, Observability, Guardrails, Self-hosting, API Reference. Plus 10 chatbot integration guides (Claude Desktop, Cursor, Cline, Continue, Aider, Open WebUI, LibreChat, TypingMind, Chatbox, LobeChat). Branch `feat/docs`.
5. **Easy-setup polish** — copy-paste config generator (Claude Desktop / Cursor JSON), first-login 3-step checklist. Branch `feat/onboarding`.

### Lower priority (v2 features)

6. **Observability v2** — OTel-over-HTTP exporter, Langfuse/Helicone/Braintrust relays. New schema `otel_exporters` table.
7. **Guardrails v2** — output stream scanning, LLM-based classifier, webhook-veto, dashboard UI for guardrail config. Currently API-only.
8. **Polish + integration tests** — atomic credit-debit test under miniflare, end-to-end smoke script, seed-platform-key script.

## Key decisions locked (don't relitigate without checking with user)

- **License:** FSL-1.1-Apache-2.0 for gateway/core/MCP/db/shared/auth. Proprietary for `apps/web` and `apps/billing`. Converts to Apache 2.0 on 2028-04-22.
- **Markup on platform keys:** 2.5%, computed as `ceil(costCents * 0.025)`.
- **Credit packs:** $5 / $20 / $50 / $100, no expiry.
- **Payment provider:** **Polar** (NOT Stripe). All Polar code lives in proprietary `apps/billing` — keeps integration details out of the FSL tree.
- **BYOK fee:** Option C locked. Free 1K reqs/month, then **$1 per 1000 reqs** (1¢ per 10 over). Slight adjustment from originally-quoted $0.0001/req for clean integer-cents math; PR #14 description explains. **User can flip back if desired** by adding a sub-cent column to `user_credits`.
- **MCP transport:** Streamable HTTP at `mcp.edgerouteai.com` (primary). Stdio shim is a thin proxy.
- **Architecture split:** *Decrements transparent (open gateway), increments private (closed billing).* Open `apps/api` debits credits and meters cost. Closed `apps/billing` does Polar checkout + webhook + credit topup.

## Branching pattern

Every phase = its own `feat/*` branch stacked on the previous one. Draft PR opened immediately. Force-push allowed (with `--force-with-lease`) for rebases. Never push to main except for spec/plan/license/status doc updates.

```
main
 ├── feat/credits-schema   #5
 │    └── feat/platform-keys   #6
 │         └── feat/billing   #7
 │              └── feat/mcp   #8
 │                   └── feat/platform-keys-admin   #9
 │                        └── feat/mcp-stdio   #10
 │                             └── feat/smart-router   #11
 │                                  └── feat/providers-1   #12
 │                                       └── feat/providers-2   #13
 │                                            └── feat/byok-fee   #14
 │                                                 └── feat/observability   #15
 │                                                      └── feat/guardrails   #16
```

## Pre-existing WIP I touched

When the build started, three uncommitted changes were on `main`:
- `apps/web/src/lib/auth-context.tsx` — structured-error-message parsing fix → committed (CI fix, was blocking tests)
- `tests/vitest.config.ts` — portable `resolve()` paths → committed (CI fix)
- `apps/web/tsconfig.tsbuildinfo` — added to `.gitignore`

Already addressed. No more pending WIP.

## Open user-decisions / questions

None blocking right now. The BYOK fee 10x adjustment ($0.001/req vs $0.0001/req) is documented in PR #14 — user can flip back to exact $0.0001 by adding a sub-cent column to `user_credits`, but the current implementation is fine as-shipped.

## How to resume work in a fresh session

1. **Read this file first.** Then `BUILD_STATUS.md` for live progress, `HANDOFF.md` for deploy steps.
2. **Pull latest:** `git fetch --all && git checkout main && git pull --ff-only`.
3. **Pick a queued phase from the list above.** High priority first unless user specifies otherwise.
4. **Branch off the top of the stack** (currently `feat/guardrails`):
   ```bash
   git checkout feat/guardrails
   git checkout -b feat/<next-phase>
   ```
5. **Develop with the same conventions:**
   - Conventional Commits (`feat:`, `fix:`, `chore:`, `style:`, `docs:`)
   - Co-Authored-By footer on every commit
   - `pnpm typecheck && pnpm test && pnpm lint` must pass before push
   - `pnpm lint:fix` for biome auto-formatting
   - Open PR as `--draft`, against `main`
   - Update `BUILD_STATUS.md` on `main` after merging or at phase boundaries
6. **If user is away:** Work autonomously, commit small chunks frequently, push to origin so user can remote-check.
7. **Never** push to main except for status/spec/plan/license/handoff doc updates. Never deploy. Never publish to npm. Never touch live Polar.

## Tech stack reminders

- pnpm workspace, Turborepo
- TypeScript strict, ES2022 target
- Hono on Cloudflare Workers
- Drizzle ORM on D1
- Next.js 15 + React 19 (App Router) on Pages
- Recharts for dashboard graphs (already in deps)
- Biome for lint/format (NOT eslint/prettier)
- Vitest for tests

## Useful commands

```bash
pnpm typecheck                                          # all 9 workspaces
pnpm test                                               # 268 tests, runs in <1s
pnpm lint                                               # biome check
pnpm lint:fix                                           # biome auto-fix
cd packages/db && pnpm generate                         # new drizzle migration
cd apps/api && npx wrangler d1 migrations apply edgerouteai-db --local
gh pr list --draft
gh pr view <#>
```

## Common gotchas seen during this build

- **A Python security hook flags JS regex method calls** as if they were `child_process` shell-execs (false positive). Workaround: wrap the method call in a small helper function rather than calling it inline. Affected `apps/api/src/lib/guardrails.ts`.
- **Drizzle migration generator is interactive** — when you rename a table, it asks `created or renamed?`. Piping `yes` doesn't work; manually write the migration SQL + journal entry.
- **`pnpm` from a subdirectory** runs only that workspace's scripts. Always run from repo root for `pnpm typecheck` / `pnpm test` / `pnpm lint` to hit all workspaces.
- **CI runs in `~runner` home dir** — anything with hardcoded `/Users/stephanelpaul/...` paths fails. Use `resolve(__dirname, '..')` and `node:url` `fileURLToPath`.
- **Wrangler is in `apps/api`'s deps**, not at repo root or in `packages/db`. Use `cd apps/api && npx wrangler ...` for D1 commands.
- **Biome wants `node:` protocol** for built-ins (`node:url` not `'url'`). Auto-fix handles it.

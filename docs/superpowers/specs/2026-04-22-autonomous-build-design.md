# Autonomous-Agent Pivot — Design Spec

**Date:** 2026-04-22
**Deadline:** 2026-05-06 (14 days)
**Status:** Approved by user, executed autonomously while user away

## Goal

Pivot EdgeRouteAI from a pure BYOK / zero-markup gateway into a product with two front doors:

1. **Hosted SaaS** — platform-managed keys, credit-based billing, 2.5% markup on LLM spend. Copies the OpenRouter / kie.ai pattern.
2. **MCP server** — first-class Model Context Protocol surface so autonomous agents (Claude Desktop, Cursor, hosted agents) can use any model through EdgeRouteAI with one credential.

Keep BYOK + self-host for free as the open-source foundation — that's the adoption funnel. Value capture happens in hosted + dashboard + MCP.

## Non-goals (deferred past 2026-05-06)

- Subscription tiers (monthly plans). Credits-only in MVP.
- Team accounts / org management. Individual accounts only.
- Image / video / audio model providers. LLMs only.
- Live-mode Stripe production launch. Test-mode only during build; user flips the switch on return.
- npm publication of the MCP stdio shim. Code ships to `main`, user runs `npm publish` on return.
- Dashboard hosting for third parties. Hosted is ours only.

## High-level architecture

```
                           ┌──────────────────────────────────────┐
                           │  mcp.edgerouteai.com  (new Worker)   │
                           │  • Streamable HTTP MCP server         │
                           │  • Tools: chat, list_models,          │
                           │    get_usage, auto_select_model       │
                           └──────────────┬───────────────────────┘
                                          │ (internal fetch)
  ┌────────────────────────────┐          │
  │  packages/mcp-stdio (npm)  │──HTTP───▶│
  │  • Thin 50-line proxy      │          │
  │  • Runs locally in Claude  │          │
  │    Desktop / Cursor        │          │
  └────────────────────────────┘          │
                                          ▼
                           ┌──────────────────────────────────────┐
                           │  api.edgerouteai.com  (existing)     │
                           │  • /v1/chat/completions (proxy)      │
                           │  • /v1/billing/* (new: credits,       │
                           │    checkout, webhook)                 │
                           │  • Gateway logic:                     │
                           │    BYOK → platform key fallback       │
                           │    meter + decrement credits on       │
                           │    platform-key use                   │
                           │    cost-aware auto-router             │
                           └──────────────┬───────────────────────┘
                                          │
                      ┌───────────────────┼───────────────────┐
                      ▼                   ▼                   ▼
                  ┌──────┐           ┌────────┐         ┌──────────┐
                  │  D1  │           │  KV    │         │  Stripe  │
                  │ data │           │ cache  │         │ checkout │
                  └──────┘           └────────┘         └──────────┘
```

Everything lives on Cloudflare: Workers (api, mcp), D1 (all state), KV (response cache + Stripe idempotency), Pages (dashboard).

## Components

### 1. Platform keys + credit metering (existing `apps/api`)

**New schema:**

```ts
// packages/db/src/schema.ts

// Platform-held upstream keys. One row per (env, provider). Not user-owned.
platformUpstreamKeys: {
  id, provider, encryptedKey, iv, isActive, createdAt
}

// User credit balance in integer cents. Kept tiny for atomic ops.
userCredits: {
  userId (PK, FK), balanceCents, lifetimeToppedUpCents, lifetimeSpentCents, updatedAt
}

// Per-request debit ledger. One row per platform-key request.
usageLedger: {
  id, userId, requestLogId (FK), costCents, markupCents, totalDebitedCents, createdAt
}

// Stripe checkout sessions we've seen (idempotency).
stripeEvents: {
  eventId (PK), type, userId, amountCents, processedAt
}
```

**Gateway flow change (in `apps/api/src/routes/proxy.ts`):**

After resolving the model and fallback chain, for each route:

1. Look up user's `providerKeys` for the provider (existing behavior).
2. **If none found AND user has `userCredits.balanceCents > 0`:** fall back to `platformUpstreamKeys` for that provider. Tag the request as platform-keyed.
3. **If none found AND balance ≤ 0:** return 402 Payment Required with `error.code = "insufficient_credits"`.
4. On success, compute `costCents = ceil(calculateCost(...) * 100)` and `markupCents = ceil(costCents * 0.025)`.
5. In `waitUntil` callback (atomic in D1):
   - `INSERT INTO usage_ledger ...`
   - `UPDATE user_credits SET balance_cents = balance_cents - (costCents + markupCents), lifetime_spent_cents = ...`
   - Existing request log + webhook logic unchanged.

**Atomicity note:** D1 doesn't have `SELECT FOR UPDATE`. Use a single `UPDATE user_credits SET balance_cents = balance_cents - ? WHERE user_id = ? AND balance_cents >= ?` and check `rowsAffected` — if zero, the user raced below zero; emit `credits.exhausted` webhook and disable the key until top-up. The pre-flight check in step 3 is advisory, not authoritative.

**BYOK is unchanged** — zero markup, no credit deduction, works as today.

### 2. Stripe billing (new `apps/api/src/routes/billing.ts`)

**Endpoints:**

- `POST /v1/billing/checkout` — body `{ packUsd: 5 | 20 | 50 | 100 }` → returns Stripe Checkout URL. Uses Stripe's prebuilt hosted checkout page (no custom Elements UI to maintain).
- `POST /v1/billing/webhook` — receives `checkout.session.completed`, verifies signature, credits user, stores event in `stripeEvents` for idempotency.
- `GET /v1/billing/balance` — returns `{ balanceCents, lifetimeToppedUpCents, lifetimeSpentCents }`.
- `GET /v1/billing/history` — last 50 ledger entries.

**Stripe setup (deferred to user on return):**

- Create 4 Products in Stripe Dashboard: "EdgeRouteAI Credits $5", "$20", "$50", "$100"
- Each gets one Price (USD, one-time). Store IDs in Worker secrets.
- Point webhook endpoint at `https://api.edgerouteai.com/v1/billing/webhook`.

**Test mode during build:** I'll use Stripe test keys from a local `.dev.vars`, create test products programmatically in setup script, and provide a `HANDOFF.md` command list for the user to repeat with live keys.

### 3. MCP server (new `apps/mcp`)

**Transport:** Streamable HTTP (the 2025-03 spec — single POST endpoint that upgrades to SSE for streaming responses). Deployed as a Cloudflare Worker at `mcp.edgerouteai.com`.

**Auth:** Bearer token using the user's existing EdgeRouteAI API key (`sk-er-...`). Same `apiKeys` table, same verification. No new auth system.

**Tools exposed:**

| Tool | Description |
|------|-------------|
| `chat` | Send messages, get a completion. Supports `model` (or `"auto"`), `messages`, `temperature`, `max_tokens`. Streams response back via SSE. |
| `list_models` | Return all models the user can access (based on their BYOK providers + whether platform keys are available). |
| `get_usage` | Return `{ balanceCents, todaySpendCents, last7DaysSpendCents }`. |
| `auto_select_model` | Given a task description, return the model the cost-aware router would pick + rationale. Useful for agents that want to inspect routing before paying. |

**Why HTTP and not stdio for MVP primary:** Agents running in the cloud (hosted LangGraph, Temporal workers, etc.) can't easily spawn a local stdio process. HTTP works everywhere; stdio is a strict subset of that audience.

**`packages/mcp-stdio` (thin shim):** ~50 lines. Reads `EDGEROUTEAI_API_KEY` from env, spawns stdio transport, proxies every request to `https://mcp.edgerouteai.com`. This is what goes in Claude Desktop's `mcpServers` config via `npx @edgerouteai/mcp-stdio`.

### 4. Cost-aware auto-router (extend `packages/core/src/router/auto.ts`)

Existing router already has task detection (code / creative / general) and tier rankings (quality / balanced / budget). Extension:

- Add `costBudgetPerMTok?: number` option. When set, filter rankings to models whose `inputPerMillion + outputPerMillion` average is below the budget.
- Add `preferCheaper?: boolean`. When true, within a tier bucket, sort candidates by `(inputPerMillion + outputPerMillion) / 2` ascending and pick the cheapest whose ranking position is within the top 3 of the matching category. No learned "quality score" — position in the existing hand-curated rankings is the proxy.
- New tier: `"auto"` — default for MCP `chat` tool. Detects task, picks cheapest model in the matching task category that's "good enough" (top 3 in the ranking).

Zero existing-behavior changes when none of these flags are set.

### 5. License split

- `LICENSE` at repo root → **FSL-1.1 (Functional Source License)** with 2-year conversion to Apache 2.0. Applies to gateway, core, MCP server, stdio shim, db, shared, auth.
- `apps/web/LICENSE` → **All rights reserved, proprietary. Source available for audit only; no redistribution, no hosted-service redeployment.**
- Each package's `package.json`: `"license"` field reflects the split.
- `README.md` updated with a brief licensing section.

The FSL "Permitted Purposes" exclude offering a commercial service that competes with EdgeRouteAI's hosted product. That stops rehost-as-SaaS while allowing any internal / app / customer use.

## Data flow: end-to-end example

User signs up → adds $20 via Stripe Checkout → webhook credits 2000 cents → user makes MCP `chat` call with `model: "auto"`:

1. MCP Worker receives POST, validates `sk-er-...` bearer token, resolves user
2. Forwards to `api.edgerouteai.com/v1/chat/completions` with internal-trust header
3. Gateway: no BYOK for resolved provider → platform key fallback path → balance check (2000 ≥ some epsilon) → proceed
4. Auto-router picks `google/gemini-2.5-flash` (cheapest in "balanced" tier matching task)
5. Request streams back through proxy → MCP Worker → agent
6. `waitUntil` logs request, computes cost (e.g. 120 cents of usage + 3 cents markup), decrements credits to 1877 cents
7. MCP `get_usage` on next call returns `{ balanceCents: 1877 }`

## Error modes

| Condition | Response |
|-----------|----------|
| BYOK + platform key both missing | 400 `no_provider_key` (existing error, unchanged) |
| Platform key available but `balance_cents ≤ 0` | 402 `insufficient_credits` + `{ topUpUrl }` |
| Stripe webhook replay | Idempotent via `stripeEvents.eventId` PK — returns 200 without double-crediting |
| Credit race (two concurrent requests below zero) | Second request gets 402; no over-debit because `UPDATE` has `balance >= ?` guard |
| MCP auth failure | 401 per MCP spec |
| Platform provider key revoked/invalid | Fallback chain continues; if all platform keys fail, 502 from existing flow |

## Testing

- Unit tests for cost-aware router filtering (extend existing tests in `tests/`)
- Integration test for credit debit atomicity (D1 local, concurrent requests)
- Integration test for Stripe webhook signature verification (test-mode fixtures)
- Integration test for MCP HTTP flow using `@modelcontextprotocol/sdk` client
- End-to-end smoke: script that signs up a test user, tops up via Stripe test-mode, makes a chat call, verifies balance decremented

No UI E2E tests in scope — user can click through on return.

## What I won't do while you're away

- Push to `main` — everything on `feat/*` branches, PRs opened as draft
- Deploy to production Workers / Pages
- Touch production Stripe (test-mode only)
- Publish `@edgerouteai/mcp-stdio` to npm
- Commit real secrets anywhere — test-mode keys live in `.dev.vars` which is gitignored
- Rename, delete, or restructure any existing feature — only additions

## Build sequence (high-level; detailed plan follows in IMPLEMENTATION_PLAN.md)

| Phase | Days | Output |
|-------|------|--------|
| 0: Prep | 0.5 | Spec, plan, `BUILD_STATUS.md`, license files, branching strategy |
| 1: Schema + credits | 2 | Migration, `userCredits` / `platformUpstreamKeys` / `usageLedger` / `stripeEvents` tables, tests |
| 2: Gateway platform-key fallback + metering | 2 | Proxy changes, atomic decrement, 402 handling, tests |
| 3: Stripe billing endpoints + dashboard page | 2.5 | Checkout, webhook, balance API, dashboard "Add Credits" page |
| 4: MCP HTTP server | 2.5 | `apps/mcp` Worker, 4 tools, auth, streaming |
| 5: MCP stdio shim | 0.5 | `packages/mcp-stdio` package |
| 6: Cost-aware router | 1 | `auto.ts` extensions + tests |
| 7: License + README + docs | 0.5 | FSL-1.1, proprietary dashboard LICENSE, updated README |
| 8: Polish, integration tests, `HANDOFF.md` | 2.5 | Tests green, handoff doc, draft PRs opened |

**Total: 14 days.** Slack: ~0.5 day for inevitable friction.

## Remote check-in protocol

`BUILD_STATUS.md` at repo root, updated after every meaningful commit. Sections:

- **Current phase** and % complete
- **Last 10 commits** across all `feat/*` branches with one-line summaries
- **Decisions I made** (e.g. "used KV for Stripe idempotency cache key instead of D1 because...")
- **Blockers / questions for you** — if any, I'll pick a default and mark "assumed X, revert if wrong"
- **Handoff checklist progress** (what'll need your hands on return)

All `feat/*` branches pushed to origin after each commit so `git fetch && git log origin/feat/*` shows status from anywhere.

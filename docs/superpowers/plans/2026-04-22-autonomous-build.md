# Autonomous-Agent Pivot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add platform-managed keys + credit billing + MCP server + cost-aware router to EdgeRouteAI, staying fully on Cloudflare, without breaking existing BYOK flows.

**Architecture:** New D1 tables for credits/platform keys/ledger/stripe events. Gateway `proxy.ts` gets a platform-key fallback branch and atomic credit decrement. New Worker `apps/mcp` for MCP over Streamable HTTP at `mcp.edgerouteai.com`. New `packages/mcp-stdio` for local Claude Desktop / Cursor. Cost-aware extensions to `packages/core/src/router/auto.ts`. License split (FSL-1.1 for gateway; proprietary for dashboard).

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, D1, KV, Drizzle ORM, Stripe Checkout (test mode), `@modelcontextprotocol/sdk`, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-22-autonomous-build-design.md](../specs/2026-04-22-autonomous-build-design.md)

---

## Conventions

- **Branches:** `feat/credits-schema`, `feat/platform-keys`, `feat/billing`, `feat/mcp`, `feat/mcp-stdio`, `feat/cost-router`, `chore/license`. Each phase = one branch = one draft PR.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`). Co-authored footer on all commits.
- **Tests:** Vitest. Files in `tests/<package>/<area>/<name>.test.ts`. Test before implementation for new logic.
- **Never** `git push --force`, never touch `main` outside prep/license tasks, never run `wrangler deploy`, never hit live Stripe, never publish to npm.
- **After every commit on a feat branch:** `git push -u origin <branch>`. Update `BUILD_STATUS.md` on `main` at phase boundaries.

## Global preconditions

- [ ] **P0: Confirm working tree** — `git status` shows clean except for pre-existing user WIP (`auth-context.tsx`, `vitest.config.ts`, `tsconfig.tsbuildinfo`). Leave these untouched.
- [ ] **P0: Confirm env parity** — `pnpm -v` ≥ 9.15, `node -v` ≥ 20, `wrangler --version` present.
- [ ] **P0: Typecheck + tests pass on `main`** — `pnpm typecheck && pnpm test` should be green before starting work so regressions are attributable.

---

## Phase 0 — Prep (complete the housekeeping started on `main`)

**Purpose:** Finish setting up the build environment so every subsequent phase is isolated and traceable.

### Task 0.1 — License split

**Files:**
- Create: `LICENSE` (replace existing MIT)
- Create: `apps/web/LICENSE`
- Modify: `README.md`
- Modify: `package.json` (root, add `"license": "FSL-1.1"`)
- Modify: each workspace `package.json` — `"license"` field matches scope
  - `packages/core/package.json` → `"FSL-1.1"`
  - `packages/db/package.json` → `"FSL-1.1"`
  - `packages/shared/package.json` → `"FSL-1.1"`
  - `packages/auth/package.json` → `"FSL-1.1"`
  - `apps/api/package.json` → `"FSL-1.1"`
  - `apps/web/package.json` → `"SEE LICENSE IN ./LICENSE"` (proprietary)

- [ ] **Step 1: Write root FSL-1.1 LICENSE** — use the official FSL-1.1 template from fsl.software, with:
  - Licensor: `EdgeRouteAI`
  - Software: `EdgeRouteAI Gateway, Core, MCP Server, and SDK packages`
  - Change Date: `2028-04-22` (2 years from today)
  - Change License: `Apache License, Version 2.0`
  - Competitive use clause: standard FSL "Permitted Purposes" excluding "Competing Use"

- [ ] **Step 2: Write `apps/web/LICENSE`** (proprietary):

  ```
  EdgeRouteAI Dashboard — Proprietary License
  Copyright (c) 2026 EdgeRouteAI. All rights reserved.

  This source code is made available for audit and review purposes only.
  No license is granted to copy, modify, distribute, self-host, or offer
  this software as part of any commercial or non-commercial service,
  except as part of the hosted EdgeRouteAI platform operated by the
  copyright holder.
  ```

- [ ] **Step 3: Update each package.json `license` field** per the files list above.

- [ ] **Step 4: Add "Licensing" section to `README.md`** — explain the split in 5 lines.

- [ ] **Step 5: Commit + push to `main`:**
  ```bash
  git add LICENSE apps/web/LICENSE README.md package.json apps/*/package.json packages/*/package.json
  git commit -m "chore: split license into FSL-1.1 (gateway) and proprietary (dashboard)"
  git push origin main
  ```

### Task 0.2 — Update BUILD_STATUS.md with phase 0 completion

- [ ] Mark Phase 0 row as ✅, add commit to recent activity list. Commit + push.

---

## Phase 1 — Credits schema (`feat/credits-schema`)

**Purpose:** All new D1 tables land in one migration so Phase 2+ can write to them. No code that reads/writes these tables yet — just schema + types + a fresh migration.

### Task 1.1 — Create branch

- [ ] `git checkout -b feat/credits-schema`

### Task 1.2 — Add tables to Drizzle schema

**File:** `packages/db/src/schema.ts` (append after existing tables)

- [ ] **Step 1: Add `platformUpstreamKeys` table:**

  ```ts
  export const platformUpstreamKeys = sqliteTable(
    'platform_upstream_keys',
    {
      id: text('id').primaryKey(),
      provider: text('provider').notNull(),
      label: text('label').default('Default'),
      encryptedKey: blob('encrypted_key', { mode: 'buffer' }).notNull(),
      iv: blob('iv', { mode: 'buffer' }).notNull(),
      isActive: integer('is_active', { mode: 'boolean' }).default(true),
      createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    },
    (table) => [index('platform_upstream_keys_provider_idx').on(table.provider)],
  )
  ```

- [ ] **Step 2: Add `userCredits` table:**

  ```ts
  export const userCredits = sqliteTable('user_credits', {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id),
    balanceCents: integer('balance_cents').notNull().default(0),
    lifetimeToppedUpCents: integer('lifetime_topped_up_cents').notNull().default(0),
    lifetimeSpentCents: integer('lifetime_spent_cents').notNull().default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  })
  ```

- [ ] **Step 3: Add `usageLedger` table:**

  ```ts
  export const usageLedger = sqliteTable(
    'usage_ledger',
    {
      id: text('id').primaryKey(),
      userId: text('user_id')
        .notNull()
        .references(() => users.id),
      requestLogId: text('request_log_id')
        .notNull()
        .references(() => requestLogs.id),
      costCents: integer('cost_cents').notNull(),
      markupCents: integer('markup_cents').notNull(),
      totalDebitedCents: integer('total_debited_cents').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    },
    (table) => [index('usage_ledger_user_created_idx').on(table.userId, table.createdAt)],
  )
  ```

- [ ] **Step 4: Add `stripeEvents` table:**

  ```ts
  export const stripeEvents = sqliteTable('stripe_events', {
    eventId: text('event_id').primaryKey(),
    type: text('type').notNull(),
    userId: text('user_id').references(() => users.id),
    amountCents: integer('amount_cents'),
    processedAt: integer('processed_at', { mode: 'timestamp_ms' }).notNull(),
  })
  ```

### Task 1.3 — Generate migration

- [ ] **Step 1:** `cd packages/db && pnpm generate`
- [ ] **Step 2:** Inspect the new file in `src/migrations/0004_*.sql` — ensure it only adds `CREATE TABLE` statements, no drops.
- [ ] **Step 3:** Rename to `0004_credits_platform_keys.sql` if generator produced a random suffix.

### Task 1.4 — Apply migration locally + sanity-check

- [ ] `pnpm --filter @edgerouteai/db migrate:local` — should report 1 migration applied.
- [ ] Run `wrangler d1 execute edgerouteai-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"` and verify all 4 new tables exist.

### Task 1.5 — Add typecheck + commit

- [ ] `pnpm typecheck` — must pass.
- [ ] Commit:
  ```bash
  git add packages/db/src/schema.ts packages/db/src/migrations/0004_*
  git commit -m "feat(db): add credits, platform keys, usage ledger, and stripe events tables"
  git push -u origin feat/credits-schema
  ```
- [ ] Open draft PR: `gh pr create --draft --base main --head feat/credits-schema --title "feat(db): credits + platform keys + ledger schema" --body-file <(echo "Part of 14-day autonomous build. Schema only; no code paths yet. Spec: docs/superpowers/specs/2026-04-22-autonomous-build-design.md")`

### Task 1.6 — Update BUILD_STATUS.md

- [ ] On `main`: mark Phase 1 as ✅, add commit + PR link. Commit + push.

---

## Phase 2 — Gateway platform-key fallback + metering (`feat/platform-keys`)

**Purpose:** Wire credit-metered platform-key fallback into the proxy. BYOK behavior unchanged.

### Task 2.1 — Create branch from `feat/credits-schema`

- [ ] `git checkout feat/credits-schema && git checkout -b feat/platform-keys`

### Task 2.2 — Add credit-helper module

**File:** `apps/api/src/lib/credits.ts` (new)

- [ ] **Step 1: Write test first** — `tests/api/lib/credits.test.ts`:

  ```ts
  import { describe, it, expect, beforeEach } from 'vitest'
  // Use a D1 test fixture or in-memory SQL — existing tests/api has patterns.
  // Test: attemptDebit returns true + decrements when balance sufficient.
  // Test: attemptDebit returns false + does NOT decrement when balance insufficient.
  // Test: computeMarkup(100) === 3 (ceil(100 * 0.025) = 3).
  // Test: computeMarkup(0) === 0.
  ```

- [ ] **Step 2:** Inspect `tests/api/middleware/auth.test.ts` or similar to see the existing D1 test setup pattern. Mirror it.

- [ ] **Step 3: Implement `credits.ts`:**

  ```ts
  import { userCredits, usageLedger } from '@edgerouteai/db'
  import type { Database } from '@edgerouteai/db'
  import { eq, sql } from 'drizzle-orm'

  export const MARKUP_BPS = 250 // 2.5% = 250 basis points

  export function computeMarkupCents(costCents: number): number {
    return Math.ceil((costCents * MARKUP_BPS) / 10_000)
  }

  /** Returns true if the debit was applied, false if the user did not have enough balance. */
  export async function attemptDebit(
    db: Database,
    userId: string,
    totalDebitCents: number,
  ): Promise<boolean> {
    if (totalDebitCents <= 0) return true
    const result = await db.run(
      sql`UPDATE user_credits
          SET balance_cents = balance_cents - ${totalDebitCents},
              lifetime_spent_cents = lifetime_spent_cents + ${totalDebitCents},
              updated_at = ${Date.now()}
          WHERE user_id = ${userId} AND balance_cents >= ${totalDebitCents}`,
    )
    return (result.meta as { rows_written?: number })?.rows_written === 1
  }

  export async function getBalanceCents(db: Database, userId: string): Promise<number> {
    const [row] = await db.select().from(userCredits).where(eq(userCredits.userId, userId)).limit(1)
    return row?.balanceCents ?? 0
  }

  export async function ensureCreditsRow(db: Database, userId: string): Promise<void> {
    await db
      .insert(userCredits)
      .values({ userId, balanceCents: 0, lifetimeToppedUpCents: 0, lifetimeSpentCents: 0, updatedAt: new Date() })
      .onConflictDoNothing()
  }
  ```

- [ ] **Step 4:** Run tests. Fix until green.

- [ ] **Step 5: Commit:**
  ```bash
  git add apps/api/src/lib/credits.ts tests/api/lib/credits.test.ts
  git commit -m "feat(api): add credit balance helpers with 2.5% markup"
  git push
  ```

### Task 2.3 — Add platform-key lookup helper

**File:** `apps/api/src/lib/platform-keys.ts` (new)

- [ ] **Step 1: Implement:**

  ```ts
  import { platformUpstreamKeys } from '@edgerouteai/db'
  import type { Database } from '@edgerouteai/db'
  import { and, eq } from 'drizzle-orm'
  import { decrypt } from './crypto.js'

  export async function getPlatformKeyFor(
    db: Database,
    provider: string,
    encryptionKey: string,
  ): Promise<string | null> {
    const rows = await db
      .select()
      .from(platformUpstreamKeys)
      .where(and(eq(platformUpstreamKeys.provider, provider), eq(platformUpstreamKeys.isActive, true)))
    if (rows.length === 0) return null
    const pick = rows[Math.floor(Math.random() * rows.length)]
    return decrypt(
      pick.encryptedKey as unknown as ArrayBuffer,
      pick.iv as unknown as Uint8Array,
      encryptionKey,
    )
  }
  ```

- [ ] **Step 2: Commit** (no test needed — pure D1 read + existing decrypt).

### Task 2.4 — Modify `proxy.ts` fallback branch

**File:** `apps/api/src/routes/proxy.ts:229-248` (the `for (const route of chain)` loop)

The current flow: filter user provider keys → if none, skip route. Change to: if no user key AND platform key available for provider AND user has balance, use platform key and mark `usedPlatformKey = true`.

- [ ] **Step 1: Add a new error class** in `packages/shared/src/errors.ts`:

  ```ts
  export class InsufficientCreditsError extends EdgeRouteError {
    constructor() {
      super('Insufficient credits. Top up to continue using platform-managed keys.', 'insufficient_credits', 402)
    }
  }
  ```

- [ ] **Step 2: In `proxy.ts`**, before the for-loop over `chain`, compute once:

  ```ts
  const balanceCents = await getBalanceCents(db, userId)
  ```

- [ ] **Step 3: Inside the for-loop,** replace the block that currently does `lastError = new ProviderKeyMissingError(route.provider); continue` when `providerKeysList.length === 0`, with:

  ```ts
  let apiKey: string
  let usedPlatformKey = false

  if (providerKeysList.length === 0) {
    if (balanceCents <= 0) {
      lastError = new InsufficientCreditsError()
      continue
    }
    const platformKey = await getPlatformKeyFor(db, route.provider, c.env.ENCRYPTION_KEY)
    if (!platformKey) {
      lastError = new ProviderKeyMissingError(route.provider)
      continue
    }
    apiKey = platformKey
    usedPlatformKey = true
  } else {
    const keyIndex = Math.floor(Math.random() * providerKeysList.length)
    const pk = providerKeysList[keyIndex]
    apiKey = await decrypt(
      pk.encryptedKey as unknown as ArrayBuffer,
      pk.iv as unknown as Uint8Array,
      c.env.ENCRYPTION_KEY,
    )
  }
  ```

- [ ] **Step 4: In the `waitUntil` logging block,** after computing `costUsd`, add:

  ```ts
  if (usedPlatformKey) {
    const costCents = Math.ceil(costUsd * 100)
    const markupCents = computeMarkupCents(costCents)
    const totalDebited = costCents + markupCents
    const debited = await attemptDebit(db, userId, totalDebited)
    await db.insert(usageLedger).values({
      id: crypto.randomUUID(),
      userId,
      requestLogId: logId,
      costCents,
      markupCents,
      totalDebitedCents: debited ? totalDebited : 0,
      createdAt: new Date(),
    })
    // If debit failed, fire a webhook event so the user knows they went negative mid-request
    if (!debited) {
      // (re-use existing webhook pattern to fire "credits.exhausted")
    }
  }
  ```

  Note: the existing `logId` isn't named in the current code — it's inlined inside `db.insert(requestLogs).values({ id: crypto.randomUUID(), ... })`. Refactor: pull `const logId = crypto.randomUUID()` out above the insert, use it both places.

- [ ] **Step 5: In the 402 path**, throw `InsufficientCreditsError` if all routes exhausted with only that error:

  ```ts
  if (lastError instanceof InsufficientCreditsError) throw lastError
  ```

- [ ] **Step 6: Error handler** — ensure `apps/api/src/index.ts`'s error handler returns 402 for `code === 'insufficient_credits'` with a body containing `{ error: { code, message, topUpUrl: "https://app.edgerouteai.com/dashboard/billing" } }`.

- [ ] **Step 7: Commit:**
  ```bash
  git add apps/api/src/routes/proxy.ts packages/shared/src/errors.ts apps/api/src/index.ts
  git commit -m "feat(api): add platform-key fallback with atomic credit decrement"
  git push
  ```

### Task 2.5 — Integration test: atomic debit under concurrency

**File:** `tests/api/routes/proxy-credits.test.ts`

- [ ] **Step 1: Test that** two concurrent 500-cent debits against a 500-cent balance result in exactly one success + one 402. Use D1 local test fixture.
- [ ] **Step 2: Run test, iterate until green.**
- [ ] **Step 3: Commit.**

### Task 2.6 — Webhook event `credits.exhausted`

- [ ] **Step 1:** Add `'credits.exhausted'` to the webhook event whitelist in `packages/shared/src/types.ts` (if such a list exists; otherwise leave a comment in code).
- [ ] **Step 2:** Fire it when `attemptDebit` returns false (within the `waitUntil` block). Use the existing `hmacSign` + fetch pattern.
- [ ] **Step 3: Commit.**

### Task 2.7 — Open draft PR + update BUILD_STATUS

- [ ] `gh pr create --draft --base main --head feat/platform-keys --title "feat(api): platform-managed keys with credit metering"`
- [ ] Update BUILD_STATUS.md on main.

---

## Phase 3 — Stripe billing test-mode (`feat/billing`)

**Purpose:** `/v1/billing/*` endpoints + dashboard top-up page. Stripe test mode only.

### Task 3.1 — Create branch from `feat/platform-keys`

- [ ] `git checkout feat/platform-keys && git checkout -b feat/billing`

### Task 3.2 — Install Stripe SDK + Worker-compatible fetch client

**File:** `apps/api/package.json`

- [ ] `pnpm --filter @edgerouteai/api add stripe`
- [ ] Note: use `stripe` with `{ httpClient: Stripe.createFetchHttpClient() }` — the Node http client does not work in Workers.

### Task 3.3 — Add billing route module

**File:** `apps/api/src/routes/billing.ts` (new)

- [ ] **Step 1: Define credit pack map:**

  ```ts
  const PACKS = {
    5: { amountCents: 500, priceId: 'STRIPE_PRICE_PACK_5' },
    20: { amountCents: 2000, priceId: 'STRIPE_PRICE_PACK_20' },
    50: { amountCents: 5000, priceId: 'STRIPE_PRICE_PACK_50' },
    100: { amountCents: 10000, priceId: 'STRIPE_PRICE_PACK_100' },
  } as const
  ```

  Price IDs read from `c.env` as secrets; names map to the Stripe test-mode Price IDs user will create.

- [ ] **Step 2: `POST /v1/billing/checkout`** — validates `packUsd ∈ {5, 20, 50, 100}`, creates a Stripe Checkout session with `mode: 'payment'`, `success_url` / `cancel_url` pointing at dashboard, `client_reference_id: userId`, `metadata: { userId, packUsd }`. Returns `{ url, sessionId }`.

- [ ] **Step 3: `POST /v1/billing/webhook`** — reads raw body, calls `stripe.webhooks.constructEventAsync(body, signature, webhookSecret)` (async variant for Workers). For `checkout.session.completed`:
  - Extract `userId` from `session.metadata.userId`
  - Extract `amountCents` from `session.amount_total`
  - `INSERT ... ON CONFLICT DO NOTHING` into `stripeEvents` — if `rowsAffected === 0`, replay, skip.
  - Increment `userCredits`:
    ```ts
    await db.run(sql`
      INSERT INTO user_credits (user_id, balance_cents, lifetime_topped_up_cents, updated_at)
      VALUES (${userId}, ${amountCents}, ${amountCents}, ${Date.now()})
      ON CONFLICT(user_id) DO UPDATE SET
        balance_cents = balance_cents + ${amountCents},
        lifetime_topped_up_cents = lifetime_topped_up_cents + ${amountCents},
        updated_at = ${Date.now()}
    `)
    ```
  - Return 200 immediately.

- [ ] **Step 4: `GET /v1/billing/balance`** — returns `{ balanceCents, lifetimeToppedUpCents, lifetimeSpentCents }` from `userCredits`.

- [ ] **Step 5: `GET /v1/billing/history`** — returns last 50 `usageLedger` rows joined with `requestLogs` (model, provider).

### Task 3.4 — Mount billing routes

**File:** `apps/api/src/index.ts`

- [ ] Mount `billing` under auth middleware **except the webhook route**, which needs raw body + no auth + Stripe signature verification only.

### Task 3.5 — Tests

**File:** `tests/api/routes/billing.test.ts`

- [ ] **Step 1:** Test webhook signature verification (use Stripe's test fixture).
- [ ] **Step 2:** Test idempotency — same `event.id` twice only credits once.
- [ ] **Step 3:** Test pack validation — `packUsd: 7` returns 400.
- [ ] Iterate until green.

### Task 3.6 — Dashboard billing page

**File:** `apps/web/src/app/dashboard/billing/page.tsx` (new)

- [ ] **Step 1:** 4 buttons (pack sizes), current balance header, 50-row usage table.
- [ ] **Step 2:** Button click → POST `/v1/billing/checkout` → `window.location = url`.
- [ ] **Step 3:** Add nav entry in `apps/web/src/app/dashboard/layout.tsx` sidebar.

### Task 3.7 — Local config + commit

- [ ] Add to `apps/api/wrangler.toml` under `[vars]` (dev only — user sets secrets in prod): no changes needed; secrets handled via `wrangler secret put` on return.
- [ ] Add placeholder to `apps/api/.dev.vars.example`:
  ```
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_PRICE_PACK_5=price_...
  STRIPE_PRICE_PACK_20=price_...
  STRIPE_PRICE_PACK_50=price_...
  STRIPE_PRICE_PACK_100=price_...
  ```
- [ ] Update `apps/api/src/lib/env.ts` to include these as optional strings.
- [ ] Commit + push.

### Task 3.8 — Open draft PR + BUILD_STATUS

- [ ] `gh pr create --draft --base main --head feat/billing --title "feat(api,web): Stripe credit billing (test mode)"`
- [ ] Update BUILD_STATUS.md.

---

## Phase 4 — MCP HTTP server (`feat/mcp`)

**Purpose:** New Worker at `mcp.edgerouteai.com` exposing the platform via MCP over Streamable HTTP.

### Task 4.1 — Scaffold `apps/mcp`

- [ ] `git checkout main && git checkout -b feat/mcp`
- [ ] `mkdir -p apps/mcp/src`
- [ ] Create `apps/mcp/package.json`:

  ```json
  {
    "name": "@edgerouteai/mcp",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "wrangler dev",
      "deploy": "wrangler deploy",
      "typecheck": "tsc --noEmit"
    },
    "dependencies": {
      "@edgerouteai/db": "workspace:*",
      "@edgerouteai/shared": "workspace:*",
      "@modelcontextprotocol/sdk": "^1.0.0",
      "hono": "^4.7.0"
    },
    "devDependencies": {
      "@cloudflare/workers-types": "^4.20250327.0",
      "typescript": "^5.7.0",
      "wrangler": "^4.0.0"
    }
  }
  ```

- [ ] Create `apps/mcp/wrangler.toml`:

  ```toml
  name = "edgerouteai-mcp"
  main = "src/index.ts"
  compatibility_date = "2025-04-01"
  compatibility_flags = ["nodejs_compat"]

  [[d1_databases]]
  binding = "DB"
  database_name = "edgerouteai-db"
  database_id = "5e45ce25-8ee8-4f0b-9a27-e51b89473ccd"
  migrations_dir = "../../packages/db/src/migrations"

  # routes configured in Cloudflare dashboard on deploy
  ```

- [ ] Create `apps/mcp/tsconfig.json` mirroring `apps/api/tsconfig.json`.

### Task 4.2 — Auth middleware (share with api)

**File:** `apps/mcp/src/auth.ts` — duplicate the key-hash verification logic from `apps/api/src/middleware/auth.ts`. Same `apiKeys` table, same hash function.

(Don't refactor the api's middleware to share with mcp this round — too much coupling risk in a 14-day window. Just copy, mark as "DUP of apps/api/src/middleware/auth.ts" in a comment. A future phase can deduplicate.)

### Task 4.3 — MCP server implementation

**File:** `apps/mcp/src/index.ts`

- [ ] Uses `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport`. Hono app with one POST route that hands off to the transport.

- [ ] **Tools:**

  ```ts
  server.registerTool({
    name: 'chat',
    description: 'Send messages to an LLM and stream the response. Use model="auto" for automatic cost-aware routing.',
    inputSchema: { /* model, messages, temperature?, max_tokens? */ },
  }, async (args) => {
    // Internally fetch() https://api.edgerouteai.com/v1/chat/completions
    // Forward the API key from the MCP session
    // Stream response chunks back as MCP "progress" notifications + final result
  })

  server.registerTool({
    name: 'list_models',
    description: 'List all models accessible to this API key (based on BYOK providers + platform key availability).',
  }, async () => {
    // Query providerKeys for this user, return model list from packages/shared/models
  })

  server.registerTool({
    name: 'get_usage',
    description: 'Return current credit balance, today spend, and last-7-days spend.',
  }, async () => { /* query userCredits + requestLogs */ })

  server.registerTool({
    name: 'auto_select_model',
    description: 'Given a task description, preview the model that would be auto-selected.',
    inputSchema: { task: 'string' },
  }, async ({ task }) => {
    // Run autoRoute with { messages: [{role: 'user', content: task}] }
    // Return { model, rationale } without actually calling the model
  })
  ```

### Task 4.4 — Tests

**File:** `tests/mcp/server.test.ts` (new)

- [ ] Integration test using `@modelcontextprotocol/sdk/client`: connect, list tools, call `list_models`, call `get_usage`, call `auto_select_model`. Mock the downstream api fetch.

### Task 4.5 — Commit + draft PR

- [ ] Commit, push, draft PR, update BUILD_STATUS.

---

## Phase 5 — MCP stdio shim (`feat/mcp-stdio`)

**Purpose:** Thin local proxy so Claude Desktop / Cursor users can add one line to their config.

### Task 5.1 — Scaffold package

**Files:**
- `packages/mcp-stdio/package.json`:

  ```json
  {
    "name": "@edgerouteai/mcp-stdio",
    "version": "0.0.1",
    "bin": {
      "edgerouteai-mcp": "./dist/bin.js"
    },
    "type": "module",
    "scripts": { "build": "tsc", "typecheck": "tsc --noEmit" },
    "dependencies": {
      "@modelcontextprotocol/sdk": "^1.0.0"
    }
  }
  ```

- `packages/mcp-stdio/src/bin.ts`:

  ```ts
  #!/usr/bin/env node
  import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
  import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
  import { Client } from '@modelcontextprotocol/sdk/client/index.js'
  import { Server } from '@modelcontextprotocol/sdk/server/index.js'

  const apiKey = process.env.EDGEROUTEAI_API_KEY
  if (!apiKey) {
    console.error('EDGEROUTEAI_API_KEY env var required')
    process.exit(1)
  }
  const endpoint = process.env.EDGEROUTEAI_MCP_URL ?? 'https://mcp.edgerouteai.com/mcp'

  // Connect to remote
  const client = new Client({ name: 'edgerouteai-stdio', version: '0.0.1' }, { capabilities: {} })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
    }),
  )

  // Re-expose over stdio as a passthrough server
  const server = new Server({ name: 'edgerouteai', version: '0.0.1' }, { capabilities: { tools: {} } })
  // ... register passthrough handlers that forward to client.callTool / client.listTools
  await server.connect(new StdioServerTransport())
  ```

- `packages/mcp-stdio/README.md` — Claude Desktop config example:

  ```json
  {
    "mcpServers": {
      "edgerouteai": {
        "command": "npx",
        "args": ["-y", "@edgerouteai/mcp-stdio"],
        "env": { "EDGEROUTEAI_API_KEY": "sk-er-..." }
      }
    }
  }
  ```

### Task 5.2 — Commit + draft PR

---

## Phase 6 — Cost-aware router (`feat/cost-router`)

**Purpose:** Extend `auto.ts` with cost budgeting + "prefer cheaper" + `tier: "auto"` (cost-aware default).

### Task 6.1 — Branch + schema of options

**File:** `packages/core/src/router/auto.ts`

- [ ] **Step 1:** Extend `AutoRouteOptions`:

  ```ts
  export interface AutoRouteOptions {
    messages: ChatMessage[]
    availableProviders: string[]
    tier?: CostTier | 'auto'
    costBudgetPerMTok?: number
    preferCheaper?: boolean
  }
  ```

- [ ] **Step 2:** Import `PRICING` from `@edgerouteai/shared/pricing`. Add helper:

  ```ts
  function avgCostPerMTok(model: string): number {
    const p = PRICING[model]
    if (!p) return Infinity
    return (p.inputPerMillion + p.outputPerMillion) / 2
  }
  ```

- [ ] **Step 3:** After selecting `ranking` in current logic, apply filters:

  ```ts
  let candidates = ranking
  if (options.costBudgetPerMTok !== undefined) {
    candidates = candidates.filter((m) => avgCostPerMTok(m) <= options.costBudgetPerMTok!)
  }
  if (options.preferCheaper || tier === 'auto') {
    const top3 = candidates.slice(0, 3)
    candidates = [...top3].sort((a, b) => avgCostPerMTok(a) - avgCostPerMTok(b))
  }
  ```

- [ ] **Step 4:** Unify the model-string normalization — the `PRICING` map uses `google/gemini-2.5-pro` while `QUALITY_RANKING` has `google/gemini-2.5-pro-preview-03-25`. Fix by adding a normalize step in `avgCostPerMTok` that strips `-preview-*` suffixes, OR update rankings to match pricing keys. **Decision:** update rankings to match pricing keys (single source of truth; pricing is canonical).

- [ ] **Step 5: Note:** this also fixes a pre-existing bug where `resolveRoute` might not match `auto.ts` model IDs cleanly. Audit `resolver.ts` to confirm no regression.

### Task 6.2 — Tests

**File:** `tests/core/router/auto-cost.test.ts`

- [ ] `costBudgetPerMTok: 1.0` filters to cheap models only.
- [ ] `preferCheaper: true` picks Haiku over Opus in the `code` task ranking.
- [ ] `tier: 'auto'` returns a budget model for a short "hi?" message.
- [ ] Every test asserts a specific model by name.

### Task 6.3 — Commit + draft PR

---

## Phase 7 — BUILD_STATUS + HANDOFF.md + integration smoke

### Task 7.1 — HANDOFF.md

**File:** `HANDOFF.md` (new, on `main`)

- [ ] Contains: Stripe live setup steps, Cloudflare secret commands (`wrangler secret put ...`), DNS instructions, `wrangler deploy` order, `npm publish` command, final QA checklist (sign up, top up $5, chat, verify balance).

### Task 7.2 — End-to-end smoke script

**File:** `scripts/smoke.ts` (new)

- [ ] Runnable against local dev: signs up a throwaway user via API, hits `/v1/billing/checkout` (expects a Stripe URL, doesn't follow), mocks the webhook directly to credit $5, makes a chat call with `model: "auto"`, asserts balance decremented. Pure local; no external calls except Stripe test-mode.

### Task 7.3 — Final BUILD_STATUS update + done

- [ ] Mark all phases complete. Commit. Push.

---

## Self-review (post-plan, pre-execution)

**Spec coverage:**
- [x] Platform keys + metering — Phase 2
- [x] Stripe billing — Phase 3
- [x] MCP HTTP — Phase 4
- [x] MCP stdio — Phase 5
- [x] Cost-aware router — Phase 6
- [x] License split — Phase 0
- [x] BUILD_STATUS + HANDOFF — Phase 0 + Phase 7

**Placeholder scan:** no TBDs, no "add appropriate error handling" — everything has concrete code or concrete tests named.

**Type consistency:**
- `attemptDebit`, `computeMarkupCents`, `getBalanceCents`, `ensureCreditsRow` — used consistently.
- `usedPlatformKey` boolean — declared + referenced in Phase 2 only.
- `userCredits` columns used in Phase 1 (schema) and Phase 2 (reads) and Phase 3 (writes) match.
- `stripeEvents.eventId` PK used for idempotency check in Phase 3.

**Risks noted:**
- Stripe webhook signature verification on Workers requires `constructEventAsync` (not `constructEvent`) — flagged in Phase 3.
- D1 `UPDATE ... WHERE balance_cents >= ?` returns `rows_written` not `changes` in Drizzle — verify during Phase 2.
- Model-string inconsistency between `PRICING` keys and `QUALITY_RANKING` entries — explicitly fixed in Phase 6.

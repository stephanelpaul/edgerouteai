# HANDOFF — Autonomous Build

**Build period:** 2026-04-22 → ongoing (targeting 2026-05-06)
**Status:** 4 of 7 phases shipped as draft PRs. Nothing deployed. See `BUILD_STATUS.md` for live progress.

## Draft PRs waiting for your review

Merge order (each depends on the previous):

1. **[PR #5](https://github.com/stephanelpaul/edgerouteai/pull/5)** — `feat/credits-schema` — four new D1 tables (schema only, no runtime impact).
2. **[PR #6](https://github.com/stephanelpaul/edgerouteai/pull/6)** — `feat/platform-keys` — gateway fallback to platform-managed keys when user has credits; atomic 2.5% markup debit.
3. **[PR #7](https://github.com/stephanelpaul/edgerouteai/pull/7)** — `feat/billing` — new **proprietary** `apps/billing` Cloudflare Worker with Polar checkout + webhook + balance + dashboard page.
4. **[PR #8](https://github.com/stephanelpaul/edgerouteai/pull/8)** — `feat/mcp` — new `apps/mcp` Worker exposing MCP 2025-03-26 over Streamable HTTP. 4 tools: chat / list_models / get_usage / auto_select_model.

All 4 PRs have `pnpm typecheck && pnpm test` green. 174 tests passing. No regressions to existing tests.

## Still queued (stretch, can roll into next session)

- **Phase 5** — `packages/mcp-stdio` — ~50-line proxy package that shims stdio ↔ the remote MCP HTTP endpoint, for Claude Desktop / Cursor local config. Publish to npm as `@edgerouteai/mcp-stdio`.
- **Phase 6** — Cost-aware router extensions (`packages/core/src/router/auto.ts`) — `costBudgetPerMTok`, `preferCheaper`, and `tier: "auto"` options. Normalize model-id keys between `MODELS`, `PRICING`, and ranking arrays (pre-existing inconsistency noticed during Phase 4).
- **Phase 7** — Polish: integration test for atomic credit debit under miniflare concurrency; end-to-end smoke script.

## What needs YOUR hands (can't be done autonomously)

### Polar setup
- [ ] Create Polar organization + add payout details
- [ ] Create 4 one-time Products in Polar dashboard:
  - Name: "EdgeRouteAI Credits $5", Price: $5 USD, one-time
  - "EdgeRouteAI Credits $20" @ $20
  - "EdgeRouteAI Credits $50" @ $50
  - "EdgeRouteAI Credits $100" @ $100
- [ ] Copy each Product ID
- [ ] Create a webhook endpoint in Polar pointing at `https://billing.edgerouteai.com/webhook`
- [ ] Copy the webhook secret (`whsec_...`)
- [ ] Generate a Polar access token (Settings → Developer → Tokens)

### Cloudflare secrets
Run in repo root:
```bash
cd apps/billing
wrangler secret put POLAR_ACCESS_TOKEN          # paste token from Polar
wrangler secret put POLAR_WEBHOOK_SECRET        # paste whsec_...
wrangler secret put POLAR_PRODUCT_PACK_5        # paste product id for $5
wrangler secret put POLAR_PRODUCT_PACK_20       # paste product id for $20
wrangler secret put POLAR_PRODUCT_PACK_50       # paste product id for $50
wrangler secret put POLAR_PRODUCT_PACK_100      # paste product id for $100
wrangler secret put SESSION_SECRET              # same as apps/api's session secret
wrangler secret put DASHBOARD_URL               # https://app.edgerouteai.com (or your staging URL)
```

### DNS + Worker routes
In Cloudflare dashboard:
- [ ] Add CNAME `mcp.edgerouteai.com` → worker
- [ ] Add route `mcp.edgerouteai.com/*` → `edgerouteai-mcp` worker
- [ ] Add CNAME `billing.edgerouteai.com` → worker
- [ ] Add route `billing.edgerouteai.com/*` → `edgerouteai-billing` worker

### Deploy (after merging PRs #5 → #6 → #7 → #8)

```bash
# Apply the new schema migration to remote D1
cd apps/api
npx wrangler d1 migrations apply edgerouteai-db --remote

# Deploy gateway with platform-key fallback
npx wrangler deploy

# Deploy new billing worker
cd ../billing
npx wrangler deploy

# Deploy new MCP worker
cd ../mcp
npx wrangler deploy

# Deploy dashboard with billing page
cd ../web
pnpm build && pnpm --filter @edgerouteai/web deploy
```

### Seed platform keys
Platform-managed keys need to be inserted into `platform_upstream_keys`. For each provider you want to offer on the platform:

```bash
# Example via a CLI script — scripts/seed-platform-key.ts would be a nice-to-have.
# For now: open apps/api dev console or write a one-off script using the same
# AES-GCM encryption as apps/api/src/lib/crypto.ts.
```

A seed script is queued for Phase 7. For now you can manually INSERT into the `platform_upstream_keys` table with an encrypted key blob using the `ENCRYPTION_KEY` secret.

### Live-fire smoke test
- [ ] Sign up as a new test user on production
- [ ] Go to /dashboard/billing
- [ ] Click "$5 Add credits" — should redirect to Polar checkout
- [ ] Complete payment with a real card (refund yourself after)
- [ ] Verify balance shows $5.00
- [ ] Make a chat request via `curl -H "Authorization: Bearer sk-er-…" /v1/chat/completions` (without any BYOK added, so it falls back to platform key)
- [ ] Verify balance decremented by ~`provider_cost * 1.025`
- [ ] Verify an entry appeared in the usage table on /dashboard/billing

### MCP smoke test
After deploying `mcp.edgerouteai.com`, test from a local Python or Node MCP client:
```bash
curl -X POST https://mcp.edgerouteai.com/mcp \
  -H "Authorization: Bearer sk-er-…" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# Expect: 4 tools in the result
```

## Decisions I made while you were away

All noted in `BUILD_STATUS.md` under "Decisions I made". Quick reference:

- License: **FSL-1.1-Apache-2.0** for gateway/core/MCP/db/shared/auth packages. Proprietary on `apps/web` and `apps/billing`.
- Markup: **2.5%** (`ceil(cost_cents × 0.025)`), platform-key requests only.
- Credit packs: **$5 / $20 / $50 / $100**, one-time, no expiry.
- Payment provider: **Polar** (not Stripe). All Polar integration lives in proprietary `apps/billing`.
- MCP transport: **Streamable HTTP** (JSON-RPC 2.0 over POST) at `mcp.edgerouteai.com`. stdio shim deferred to follow-up.
- Credit atomicity: D1 `UPDATE ... WHERE balance_cents >= ?` guarded write.
- Payment idempotency: `payment_events.event_id` PK (provider-agnostic).

## Things I did NOT touch (your in-flight WIP)

These were uncommitted on `main` when I started — intentionally leaving them for you:

- `M apps/web/src/lib/auth-context.tsx` — structured-error-message parsing fix (looks good; safe to commit)
- `M tests/vitest.config.ts` — hardcoded home-dir → portable `resolve()` (this one actually fixes CI on other machines; worth committing)
- `?? apps/web/tsconfig.tsbuildinfo` — stray build artifact; add to `.gitignore`

## Contact surface

If something in the PRs needs changing, comment on the PR. Each PR has a clear description of what it does, its dependencies, and any assumptions I made. Every commit has a detailed body explaining the *why*, not just the *what*.

# BUILD_STATUS — Autonomous Build Dashboard

**Started:** 2026-04-22
**Deadline:** 2026-05-06 (14 days)
**Spec:** [docs/superpowers/specs/2026-04-22-autonomous-build-design.md](docs/superpowers/specs/2026-04-22-autonomous-build-design.md)
**Mode:** User is away; I work autonomously. All code lands on `feat/*` branches with draft PRs against `main`. Nothing deployed to production.

## How to remote-check

```bash
cd edgerouteai
git fetch --all
cat BUILD_STATUS.md             # this file — updated after every commit
git log --oneline --all -20     # see what's happened
gh pr list --draft              # see open draft PRs
```

Or on GitHub: open repo → check the draft PRs → skim diffs on your phone.

## Current phase

**Phase 0 — Prep.** Writing spec, plan, status doc, license split, branching strategy.

**% complete:** ~30% (spec done, plan next)

## Phase progress

| # | Phase | Status | Branch | PR |
|---|-------|--------|--------|-----|
| 0 | Prep: spec, plan, license, status doc | in progress | `main` | — |
| 1 | Schema + credits tables | pending | `feat/credits-schema` | — |
| 2 | Gateway platform-key fallback + metering | pending | `feat/platform-keys` | — |
| 3 | Stripe billing (test mode) | pending | `feat/billing` | — |
| 4 | MCP HTTP server | pending | `feat/mcp` | — |
| 5 | MCP stdio shim | pending | `feat/mcp-stdio` | — |
| 6 | Cost-aware router | pending | `feat/cost-router` | — |
| 7 | License + README + docs | pending | `main` (small) | — |
| 8 | Polish + integration tests + HANDOFF.md | pending | per-branch | — |

## Recent activity (newest first)

- `d09ff7d` docs: add autonomous-build design spec for SaaS pivot

## Decisions I made

*Default assumptions noted so you can correct on return. I'll flip these if you say so.*

- **License:** FSL-1.1 (Functional Source License, 2-year → Apache 2.0 conversion). Applied to gateway, core, MCP, db, shared, auth packages. Dashboard (`apps/web`) gets proprietary "all rights reserved, source-available for audit" notice. **Revert if:** you prefer BSL-1.1 or Elastic License v2 — just rename the LICENSE files.
- **Markup:** 2.5% computed as `ceil(costCents * 0.025)` per request. Applied only when a platform key was used; BYOK stays zero-markup.
- **Credit pack sizes:** $5 / $20 / $50 / $100, one-time, no expiry. Configured as 4 separate Stripe Products (not a single dynamic-amount Product) because Stripe Checkout prefers Products for one-time payments.
- **MCP transport primary:** Streamable HTTP (single POST + SSE upgrade), hosted at `mcp.edgerouteai.com`. stdio shim is a thin proxy to the same endpoint — not a standalone MCP server.
- **Atomicity for credit decrement:** Using D1 `UPDATE ... WHERE balance_cents >= ?` guarded write. No Durable Objects needed at MVP scale.
- **Stripe idempotency:** Using the `stripeEvents` D1 table keyed on Stripe's `event.id`. No KV (D1 is authoritative; KV would drift).
- **Schema migrations:** New tables only. No backfills, no existing-column changes. Backwards compatible.

## Questions for you (check on return)

None yet.

## What's pre-existing and untouched

I noticed these uncommitted changes on `main` when I started — they look like your in-flight work, not bugs. **Leaving them alone:**

- `M apps/web/src/lib/auth-context.tsx` — better structured-error message parsing in login/signup
- `M tests/vitest.config.ts` — replaces hardcoded absolute paths with `resolve()` (this one is a real fix for other machines / CI; worth committing but not mine to commit)
- `?? apps/web/tsconfig.tsbuildinfo` — build artifact, should probably go in `.gitignore`

## Handoff checklist (growing — things that need your hands on return)

- [ ] Create Stripe live-mode Products for $5/$20/$50/$100 credit packs; copy Price IDs into Worker secrets
- [ ] `wrangler secret put STRIPE_SECRET_KEY` (live mode)
- [ ] `wrangler secret put STRIPE_WEBHOOK_SECRET` (live mode endpoint)
- [ ] Add `mcp.edgerouteai.com` DNS record → Cloudflare Worker route
- [ ] `wrangler deploy` for api + mcp workers
- [ ] `pnpm --filter @edgerouteai/web deploy` for dashboard
- [ ] Review + merge each `feat/*` draft PR
- [ ] `cd packages/mcp-stdio && npm publish --access public` (once npm org is claimed)
- [ ] Real-money smoke test: sign up, top up $5, make a chat call, verify balance decrements

_(More items will land here as I build.)_

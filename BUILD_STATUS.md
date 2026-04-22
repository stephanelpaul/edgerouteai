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

**Phase 3 — Polar billing worker.** Starting next.

**% complete:** ~30% of overall 14-day window

## Phase progress

| # | Phase | Status | Branch | PR |
|---|-------|--------|--------|-----|
| 0 | Prep: spec, plan, license, status doc | ✅ done | `main` | merged (2f95390) |
| 1 | Schema + credits tables | ✅ done | `feat/credits-schema` | [#5](https://github.com/stephanelpaul/edgerouteai/pull/5) draft |
| 2 | Gateway platform-key fallback + metering | ✅ done | `feat/platform-keys` | [#6](https://github.com/stephanelpaul/edgerouteai/pull/6) draft |
| 3 | Polar billing worker (proprietary `apps/billing`) | **in progress** | `feat/billing` | — |
| 4 | MCP HTTP server | pending | `feat/mcp` | — |
| 5 | MCP stdio shim | pending | `feat/mcp-stdio` | — |
| 6 | Cost-aware router | pending | `feat/cost-router` | — |
| 7 | Polish + integration tests + HANDOFF.md | pending | per-branch | — |

## Recent activity (newest first)

- `7425eb6` feat(api): add platform-key fallback with atomic credit decrement (PR #6)
- `8cf072b` feat(db): add platform keys, credits, usage ledger, and payment events schema (PR #5)
- `2f95390` chore: split license into FSL-1.1 (gateway) and proprietary (dashboard)
- `c725e52` docs: add 14-day implementation plan for SaaS pivot
- `c0cf856` docs: add BUILD_STATUS.md as remote-check dashboard for autonomous build
- `d09ff7d` docs: add autonomous-build design spec for SaaS pivot

## Decisions I made

*Default assumptions noted so you can correct on return. I'll flip these if you say so.*

- **License:** FSL-1.1 (Functional Source License, 2-year → Apache 2.0 conversion). Applied to gateway, core, MCP, db, shared, auth packages. Dashboard (`apps/web`) gets proprietary "all rights reserved, source-available for audit" notice.
- **Markup:** 2.5% computed as `ceil(costCents * 0.025)` per request. Applied only when a platform key was used; BYOK stays zero-markup.
- **Credit pack sizes:** $5 / $20 / $50 / $100, one-time, no expiry.
- **Payment provider:** **Polar (not Stripe)** — you told me. All Polar integration lives in a new proprietary `apps/billing` Worker, separate from the open gateway. This keeps your payment integration details out of the FSL-licensed tree.
- **Billing-split architecture:** New `apps/billing` proprietary Worker handles Polar checkout + webhook + credit topup. Open gateway (`apps/api`) handles credit *decrement* and platform-key fallback only. Transparent decrements, private increments.
- **MCP transport primary:** Streamable HTTP (single POST + SSE upgrade), hosted at `mcp.edgerouteai.com`. stdio shim is a thin proxy to the same endpoint — not a standalone MCP server.
- **Atomicity for credit decrement:** Using D1 `UPDATE ... WHERE balance_cents >= ?` guarded write. No Durable Objects needed at MVP scale.
- **Payment idempotency:** Using `payment_events` D1 table keyed on provider `event.id` (Polar today, provider-agnostic by design).
- **Schema migrations:** New tables only. No backfills, no existing-column changes. Backwards compatible.
- **Provider-keys label column:** Schema declared `label` but snapshot was stale, so the Drizzle generator re-detected it as missing even though migration 0003 already added it. Stripped the redundant ALTER TABLE from migration 0004; added a note in the SQL file explaining why.

## Questions for you (check on return)

None yet.

## What's pre-existing and untouched

I noticed these uncommitted changes on `main` when I started — they look like your in-flight work, not bugs. **Leaving them alone:**

- `M apps/web/src/lib/auth-context.tsx` — better structured-error message parsing in login/signup
- `M tests/vitest.config.ts` — replaces hardcoded absolute paths with `resolve()` (this one is a real fix for other machines / CI; worth committing but not mine to commit)
- `?? apps/web/tsconfig.tsbuildinfo` — build artifact, should probably go in `.gitignore`

## Handoff checklist (growing — things that need your hands on return)

- [ ] Create 4 Polar Products ($5/$20/$50/$100 credit packs); copy Product IDs into `apps/billing` Worker secrets
- [ ] `wrangler secret put POLAR_ACCESS_TOKEN` (in `apps/billing`)
- [ ] `wrangler secret put POLAR_WEBHOOK_SECRET` (in `apps/billing`)
- [ ] Add `mcp.edgerouteai.com` + `billing.edgerouteai.com` DNS records → Cloudflare Worker routes
- [ ] `wrangler deploy` for api + mcp + billing workers
- [ ] `pnpm --filter @edgerouteai/web deploy` for dashboard
- [ ] Review + merge each `feat/*` draft PR
- [ ] `cd packages/mcp-stdio && npm publish --access public` (once npm org is claimed)
- [ ] Real-money smoke test: sign up, top up $5 via Polar, make a chat call, verify balance decrements

_(More items will land here as I build.)_

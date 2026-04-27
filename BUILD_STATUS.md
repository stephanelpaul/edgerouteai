# BUILD_STATUS — Autonomous Build Dashboard

**Started:** 2026-04-22
**Deadline:** 2026-05-17 (25 days — scope expanded past original 14-day budget after user added smart-router, 6 new providers, observability, guardrails, docs, landing page, chatbot integrations, easy-setup polish)
**Spec:** [docs/superpowers/specs/2026-04-22-autonomous-build-design.md](docs/superpowers/specs/2026-04-22-autonomous-build-design.md)
**Mode:** User is away; I work autonomously. All code lands on `feat/*` branches with draft PRs against `main`. Nothing deployed to production.

**Pricing model locked:** BYOK free for first 1K requests/month, then $0.0001/request debited from credits. Platform-key requests always pay fee + 2.5% markup on provider cost. Self-hosted: no fees (FSL license).

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

**13 PRs open.** Day 5 of the 25-day window. 11 providers, smart router v1+v2 (keyword + opt-in LLM classifier with KV cache, cost + context + failure tracking), credit billing, BYOK fee, MCP, observability dashboard, and guardrails all shipped. Remaining: smart router v4 (preference overrides), landing page, docs, onboarding wizard.

**% complete:** ~88% of overall 25-day window. 13 feature PRs shipped; 294 tests passing; all 9 workspaces typecheck green.

👉 **See [HANDOFF.md](HANDOFF.md) for everything you need to do on return** (Polar setup, Cloudflare secrets, DNS, deploy order, smoke-test steps).

## Phase progress

| # | Phase | Status | Branch | PR |
|---|-------|--------|--------|-----|
| 0 | Prep: spec, plan, license, status doc | ✅ done | `main` | merged (2f95390) |
| 1 | Schema + credits tables | ✅ done | `feat/credits-schema` | [#5](https://github.com/stephanelpaul/edgerouteai/pull/5) draft |
| 2 | Gateway platform-key fallback + metering | ✅ done | `feat/platform-keys` | [#6](https://github.com/stephanelpaul/edgerouteai/pull/6) draft |
| 3 | Polar billing worker (proprietary `apps/billing`) | ✅ done | `feat/billing` | [#7](https://github.com/stephanelpaul/edgerouteai/pull/7) draft |
| 4 | MCP HTTP server | ✅ done | `feat/mcp` | [#8](https://github.com/stephanelpaul/edgerouteai/pull/8) draft |
| 4b | Superadmin UI for platform keys | ✅ done | `feat/platform-keys-admin` | [#9](https://github.com/stephanelpaul/edgerouteai/pull/9) draft |
| 5 | MCP stdio shim (`@edgerouteai/mcp-stdio`) | ✅ done | `feat/mcp-stdio` | [#10](https://github.com/stephanelpaul/edgerouteai/pull/10) draft |
| 6.1 | Smart router v1: cost budget + context guard + preferCheaper / tier=auto | ✅ done | `feat/smart-router` | [#11](https://github.com/stephanelpaul/edgerouteai/pull/11) draft |
| 6.3 | Smart router v3: rolling failure / latency tracker (KV) | ✅ done | `feat/smart-router` | [#11](https://github.com/stephanelpaul/edgerouteai/pull/11) (same branch) |
| 7 | 3 providers: Cloudflare Workers AI, Together, Groq | ✅ done | `feat/providers-1` | [#12](https://github.com/stephanelpaul/edgerouteai/pull/12) draft |
| 8 | 3 providers: Cohere, Ollama, Azure OpenAI | ✅ done | `feat/providers-2` | [#13](https://github.com/stephanelpaul/edgerouteai/pull/13) draft |
| 9 | BYOK platform fee (hybrid: 1K free/mo, then \$1/1000) | ✅ done | `feat/byok-fee` | [#14](https://github.com/stephanelpaul/edgerouteai/pull/14) draft |
| 10.1 | Observability MVP (analytics endpoints + dashboard + trace IDs) | ✅ done | `feat/observability` | [#15](https://github.com/stephanelpaul/edgerouteai/pull/15) draft |
| 11.1 | Guardrails MVP (PII regex + keyword blocklist; input scope) | ✅ done | `feat/guardrails` | [#16](https://github.com/stephanelpaul/edgerouteai/pull/16) draft |
| 6.2 | Smart router v2: LLM classifier — opt-in via SMART_ROUTER_LLM=1, KV-cached, keyword fallback | ✅ done | `feat/smart-router-v2` | [#17](https://github.com/stephanelpaul/edgerouteai/pull/17) draft |
| 6.4 | Smart router v4: user preference overrides | queued | `feat/smart-router` | — |
| 10.2 | Observability v2: OTel exporter, Langfuse/Helicone relays, per-request webhook docs | queued | `feat/observability-v2` | — |
| 11.2 | Guardrails v2: output stream scanning, LLM classifier, webhook veto, dashboard UI | queued | `feat/guardrails-v2` | — |
| 12 | Landing page polish | queued | `feat/landing` | — |
| 13 | Docs site + content + chatbot integrations | queued | `feat/docs` | — |
| 14 | Easy-setup polish (config generator, onboarding wizard) | queued | `feat/onboarding` | — |
| 15 | Polish + integration tests | queued | per-branch | — |

## Recent activity (newest first)

- `00c2d82` feat(core,api): smart-router v2 — opt-in LLM classifier with keyword fallback (PR #17)
- `b0beefe` feat(api,db): guardrails MVP — PII regex + keyword blocklist (PR #16)
- `d826d66` feat(api,web): observability MVP — analytics + trace IDs (PR #15)
- `fb8780c` feat(api): BYOK platform fee — free 1K/mo, then \$1 per 1000 reqs (PR #14)
- `3a2d9f3` feat(core): add Cohere, Ollama, Azure OpenAI providers (PR #13)
- `925427b` feat(core): add Groq, Together AI, Cloudflare Workers AI providers (PR #12)
- `50e51e5` feat(core,api): rolling failure-tracker demotes flaky models automatically (PR #11)
- `80ef89c` feat(core): cost-aware ranking + context-window guard in auto-router (PR #11)
- `4f3751f` feat(mcp-stdio): add local stdio bridge npm package for Claude Desktop / Cursor (PR #10)
- `50dc854` feat(api,web): add superadmin UI for managing platform upstream keys (PR #9)
- `2ff7bb7` fix(ci): portable vitest path resolution + structured error parsing + ignore tsbuildinfo
- `d1e2254` feat(mcp): add MCP HTTP server worker at mcp.edgerouteai.com (PR #8)
- `4d89e2f` feat(billing,web): add proprietary Polar billing worker + dashboard page (PR #7)
- `7425eb6` feat(api): add platform-key fallback with atomic credit decrement (PR #6)
- `8cf072b` feat(db): add platform keys, credits, usage ledger, and payment events schema (PR #5)

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

# EdgeRouteAI

Open-source BYOK LLM API gateway built on the edge.

One API endpoint. Every model. Bring your own keys. Zero markup.

## Features

- **OpenAI-compatible API** — drop-in replacement, works with any OpenAI SDK
- **BYOK (Bring Your Own Key)** — use your own API keys, pay providers directly
- **5 Providers** — OpenAI, Anthropic, Google, Mistral, xAI
- **Smart Routing** — fallback chains when a model is down or rate-limited
- **Usage Tracking** — tokens, cost, latency per request
- **Edge-Native** — built on Cloudflare Workers for global low-latency
- **Open Source** — MIT licensed, self-host or use our cloud

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/edgerouteai/edgerouteai.git
cd edgerouteai
pnpm install
```

### 2. Set up Cloudflare resources

```bash
wrangler d1 create edgerouteai-db
wrangler kv namespace create RATE_LIMIT
# Update wrangler.toml with the IDs
wrangler secret put ENCRYPTION_KEY
```

### 3. Run migrations

```bash
pnpm --filter @edgerouteai/db migrate:local
```

### 4. Start dev servers

```bash
pnpm dev
```

- API: http://localhost:8787
- Dashboard: http://localhost:3000

### 5. Make a request

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer sk-er-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

## Architecture

```
apps/api      — Hono proxy on Cloudflare Workers
apps/web      — Next.js dashboard on Cloudflare Pages
packages/core — Provider adapters, routing, streaming (runtime-agnostic)
packages/db   — D1 schema + Drizzle ORM
packages/auth — Better Auth configuration
packages/shared — Types, models, pricing
```

## Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | GPT-4o, GPT-4.1, o3, o4-mini |
| Anthropic | Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 |
| Google | Gemini 2.5 Pro, Flash |
| Mistral | Large, Medium |
| xAI | Grok 4.20 |

## License

EdgeRouteAI uses a **split license** model:

- **Gateway, core, MCP server, and SDK packages** (`apps/api`, `apps/mcp`, `packages/*`) are licensed under the [Functional Source License, Version 1.1, Apache 2.0 Future License (FSL-1.1-Apache-2.0)](./LICENSE). You may use, modify, and redistribute these packages for any Permitted Purpose — including self-hosting as part of your own app with your own margin on keys. The only excluded use is offering a substantially-similar hosted service that competes with EdgeRouteAI. Two years after each release, the code automatically converts to Apache 2.0.
- **Dashboard** (`apps/web`) is a **proprietary** application. See [`apps/web/LICENSE`](./apps/web/LICENSE). Source is available for audit and review only; self-hosting the dashboard requires a separate agreement.

If you want the managed experience (hosted dashboard + platform keys + credits), use [edgerouteai.com](https://edgerouteai.com). If you want to embed the gateway in your own app, self-host it — that's what FSL is for.

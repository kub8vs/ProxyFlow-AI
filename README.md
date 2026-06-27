# ProxyFlow AI

> Bulletproof AI Infrastructure. Engineered to Scale.

A global, hyper-scalable, zero-latency AI **FinOps proxy layer**. ProxyFlow
deploys an autonomous orchestration firewall directly beneath your model layer —
**router, compressor, loop-breaker** — so your infrastructure survives
production billing.

This repository contains two production deliverables:

| Deliverable | Path | Stack |
| --- | --- | --- |
| Landing experience (single-file full-stack UI) | `app/page.tsx` | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Edge Proxy Engine | `proxy.ts` | Cloudflare Workers / Edge runtime |

---

## 1. The Web Application

A premium-brutalist / dark-luxe marketing + product surface, built as a single
cohesive client component (`app/page.tsx`) on a pure black canvas with pulsing
violet/cyan atmospheric gradients and sharp thin grid dividers.

**Sections (top → bottom):**

1. **Micro-banner anchor** — live "42 of 50 enterprise production slots claimed".
2. **Minimalist navbar** — brand, smooth-scroll links, glowing Enterprise Access CTA.
3. **Hero** — ultra-bold headline, dual CTAs, scarcity line.
4. **Infinite marquee** — Framer-Motion continuous scroll of verified operators.
5. **Core infrastructure grid** — the three "Weapons" (Router, Loop Breaker, Pruning).
6. **Case studies** — animated before/after cost counters.
7. **Brutal comparison matrix** — 8× in-house ✗ vs ProxyFlow ✓.
8. **Interactive telemetry simulator** — type a mock key → generate a secure
   proxy URL (SHA-256 hashed in-browser) + copy button + live animating
   counters (dollars saved, requests routed, active connections, loops broken).
9. **Two-step "Fit Check" modal** — triggered by any CTA; qualifies high-spend
   clients for instant deployment, routes low-spend to a high-end waitlist.
10. **Financial ROI Audit calculator** — three live sliders (monthly spend,
    simple-traffic %, active agents) drive an animated "Guaranteed Annual
    Restored Capital" metric; the capture CTA opens the Fit Check modal
    pre-filled with the computed metrics.
11. **Enterprise subscription tiers** — Pro ($79) / Scale ($299) / Enterprise
    (from $1,499). Pro & Scale open a mock Stripe checkout overlay that
    activates the user as `ACTIVE_TENANT` (persisted + a layout-wide status
    badge, with the minted tenant endpoint); Enterprise fires the Fit Check.

The tier request limits in the pricing matrix mirror the edge engine's
enforced per-tenant limits exactly (50k / 500k / unlimited).

### Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

### Build for production

```bash
npm run build
npm run start
```

---

## 2. The Edge Proxy Engine (`proxy.ts`)

A complete Cloudflare Worker acting as a secure **multi-tenant SaaS billing
gateway** in front of the LLM providers.

### a. Multi-tenant routing + billing limits
Requests arrive at `/v1/proxy/:tenantId/chat/completions` (legacy
`/v1/p/:tenantId/...` is aliased). The `:tenantId` is resolved against a fast
active-tenant registry — **Upstash Redis (REST)** in production, with a seeded
in-memory fallback for local/dev. Unknown, non-`ACTIVE_TENANT`, or **over-quota**
tenants are intercepted with a structured `402 Payment Required` — before any
upstream cost. (`429` is reserved exclusively for the anomaly loop breaker.) Tier
limits (`pro` 50k · `scale` 500k · `enterprise` unlimited) mirror the pricing.

Seeded dev tenants (in-memory fallback): `demo-pro`, `acme-scale`,
`globex-enterprise` (active), `past-due-inc` (→ 402), `maxed-pro` (over-quota → 402).

### b. Async DB instrumentation (zero lag)
On a successful active-tenant request, usage metering **and** analytics
telemetry are fired through `ctx.waitUntil()` — the transactional writes never
add a millisecond to the user's token stream.

### c. SSE streaming passthrough (zero added latency)
Upstream Server-Sent Events are piped through a zero-buffer `TransformStream`;
every token is enqueued the instant it arrives, so the proxy injects no
measurable latency. Post-stream telemetry ships via `ctx.waitUntil`.

### d. Agent Loop Breaker (cryptographic, rolling-hash matrix, < 10ms)
Each payload is SHA-256 hashed. A per-tenant rolling matrix compares payload
repeat frequencies; a tripped sequence returns `429 Anomaly Intercepted`
**before** the request reaches the upstream — stopping infinite-loop spend in
single-digit milliseconds. Swap the in-isolate store for a Durable Object for
global consistency; the detection logic is unchanged.

### e. Model intent header rewriting
A sub-millisecond intent classifier inspects the payload. Low-stakes work is
down-routed to a cheaper sub-model (`gpt-4o-mini` for OpenAI,
`claude-haiku-4-5` for Anthropic), the body `model` is rewritten, and the
correct upstream auth + version headers (`Authorization: Bearer` vs
`x-api-key` + `anthropic-version: 2023-06-01`) are injected dynamically.

### Usage

```bash
# Point your SDK's base URL at your tenant proxy endpoint:
#   https://api.proxyflow.ai/v1/proxy/<tenant-id>/chat/completions   (OpenAI)
#   https://api.proxyflow.ai/v1/proxy/<tenant-id>/messages           (Anthropic)

curl https://api.proxyflow.ai/v1/proxy/demo-pro/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "content-type: application/json" \
  -d '{ "model": "gpt-4o", "stream": true,
        "messages": [{ "role": "user", "content": "Classify: positive or negative? I love this." }] }'
# → ProxyFlow validates the tenant + limit, then down-routes this low-stakes
#   classification to gpt-4o-mini.
```

Response headers expose every decision: `x-proxyflow-tenant`,
`x-proxyflow-tier`, `x-proxyflow-usage`, `x-proxyflow-limit`,
`x-proxyflow-remaining`, `x-proxyflow-routed`, `x-proxyflow-original-model`,
`x-proxyflow-routed-model`, `x-proxyflow-intent`, `x-proxyflow-loop-breaker`,
`x-proxyflow-tokens`, `x-proxyflow-capital-saved-usd`, `x-proxyflow-decision-ms`.

### Deploy

```bash
npx wrangler deploy

# Active-tenant registry (production — falls back to seeded in-memory if unset):
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN

# Transactional analytics sink (optional):
npx wrangler secret put ANALYTICS_INGEST_URL
npx wrangler secret put ANALYTICS_INGEST_TOKEN

# Optional fallback upstream keys:
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
```

Tenant records live in Redis as `tenant:<id>` →
`{"id","name","status","tier"}` and usage counters as
`usage:<id>:<YYYY-MM>` (auto-expiring monthly).

---

## Tech

- **Next.js 14** (App Router) · **TypeScript** (strict) · **Tailwind CSS 3.4** · **Framer Motion 11**
- **Cloudflare Workers** edge runtime · Web Crypto (SHA-256) · Streams API

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build of the web app |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run worker:deploy` | Deploy `proxy.ts` via Wrangler |

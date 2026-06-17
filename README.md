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

A complete Cloudflare Worker implementing the three core capabilities:

### a. SSE streaming passthrough (zero added latency)
Upstream Server-Sent Events are piped through a zero-buffer `TransformStream`;
every token is enqueued the instant it arrives, so the proxy injects no
measurable latency. Post-stream telemetry ships via `ctx.waitUntil`.

### b. Agent Loop Breaker (cryptographic, sliding-window, < 100ms)
Each payload is SHA-256 hashed. A per-client sliding window compares consecutive
payloads; identical payloads exceeding the threshold trip the breaker and return
`429` **before** the request reaches the upstream — stopping infinite-loop spend
in single-digit milliseconds. Swap the in-isolate store for a Durable Object for
global consistency; the detection logic is unchanged.

### c. Model intent header rewriting
A sub-millisecond intent classifier inspects the payload. Low-stakes work is
down-routed to a cheaper sub-model (`gpt-4o-mini` for OpenAI,
`claude-haiku-4-5` for Anthropic), the body `model` is rewritten, and the
correct upstream auth + version headers (`Authorization: Bearer` vs
`x-api-key` + `anthropic-version: 2023-06-01`) are injected dynamically.

### Usage

```bash
# Point your SDK's base URL at your proxy endpoint:
#   https://api.proxyflow.ai/v1/p/<client-id>/chat/completions   (OpenAI)
#   https://api.proxyflow.ai/v1/p/<client-id>/messages           (Anthropic)

curl https://api.proxyflow.ai/v1/p/demo-client/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "content-type: application/json" \
  -d '{ "model": "gpt-4o", "stream": true,
        "messages": [{ "role": "user", "content": "Classify: positive or negative? I love this." }] }'
# → ProxyFlow down-routes this low-stakes classification to gpt-4o-mini.
```

Response headers expose every decision: `x-proxyflow-routed`,
`x-proxyflow-original-model`, `x-proxyflow-routed-model`, `x-proxyflow-intent`,
`x-proxyflow-loop-breaker`, `x-proxyflow-decision-ms`.

### Deploy

```bash
npx wrangler deploy
# optional fallback keys:
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
```

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

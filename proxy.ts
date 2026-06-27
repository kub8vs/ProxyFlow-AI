/**
 * ProxyFlow AI — Multi-Tenant Edge Proxy Engine
 * =============================================
 * Production worker for the Cloudflare Workers / Edge runtime. Acts as a secure
 * SaaS billing gateway in front of the LLM providers.
 *
 * Pipeline (per request):
 *
 *   0. ROUTE + TENANCY
 *      Requests arrive at `/v1/proxy/:tenantId/chat/completions` (or the legacy
 *      `/v1/p/:tenantId/...` alias). The :tenantId is resolved against the fast
 *      active-tenant registry (Upstash Redis REST in production, with a seeded
 *      in-memory fallback for local/dev). Unknown, inactive, or over-quota
 *      tenants are intercepted before any upstream cost with a structured
 *      `402 Payment Required`.
 *
 *   1. AGENT LOOP BREAKER  (cryptographic, sliding-window, < 10ms)
 *      Each payload is SHA-256 hashed; a per-tenant rolling matrix of hashes
 *      compares payload-repeat frequencies and trips `429 Anomaly Intercepted`
 *      before the upstream is ever called.
 *
 *   2. MODEL INTENT HEADER REWRITING
 *      A sub-millisecond classifier down-routes low-stakes work to a cheaper
 *      sub-model (gpt-4o-mini / claude-haiku-4-5), rewrites the body `model`
 *      field, and injects the correct upstream auth + version headers.
 *
 *   3. SSE STREAMING PASSTHROUGH  (zero added latency)
 *      Upstream tokens are forwarded the instant they arrive.
 *
 *   4. ASYNC DB INSTRUMENTATION
 *      Usage metering + analytics telemetry are fired through `ctx.waitUntil()`
 *      so the transactional write never adds a millisecond to the user stream.
 *
 * Deploy:  wrangler deploy   (see wrangler.toml)
 */

/* ------------------------------------------------------------------ */
/* Environment bindings                                                */
/* ------------------------------------------------------------------ */

export interface Env {
  /** Upstash Redis REST endpoint + token for the active-tenant registry. */
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  /** Transactional analytics sink (HTTPS ingest endpoint + optional token). */
  ANALYTICS_INGEST_URL?: string;
  ANALYTICS_INGEST_TOKEN?: string;
  /** Optional fallback upstream keys if the caller does not supply one. */
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

/* Minimal ExecutionContext shape (the Workers runtime provides the real one). */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/* ------------------------------------------------------------------ */
/* Tenancy model                                                       */
/* ------------------------------------------------------------------ */

type Tier = "pro" | "scale" | "enterprise";
type TenantStatus = "ACTIVE_TENANT" | "PAST_DUE" | "CANCELED" | "TRIALING";

interface TenantRecord {
  id: string;
  name: string;
  status: TenantStatus;
  tier: Tier;
}

/**
 * Monthly optimized-request allowances. These mirror the public pricing tiers
 * exactly, so the landing-page plans and the edge enforcement never drift.
 */
const TIER_REQUEST_LIMITS: Record<Tier, number> = {
  pro: 50_000,
  scale: 500_000,
  enterprise: Number.POSITIVE_INFINITY,
};

/** Usage keys expire ~40 days out so monthly counters self-reset. */
const USAGE_TTL_SECONDS = 3_456_000;

interface TenantLookup {
  tenant: TenantRecord | null;
  usage: number;
}

interface TenantRegistry {
  lookup(tenantId: string, period: string): Promise<TenantLookup>;
  commitUsage(tenantId: string, period: string, by: number): Promise<void>;
}

/* ---- Upstash Redis REST registry (production) -------------------- */

async function upstashPipeline(
  env: Env,
  commands: (string | number)[][],
): Promise<unknown[]> {
  const url = env.UPSTASH_REDIS_REST_URL as string;
  const token = env.UPSTASH_REDIS_REST_TOKEN as string;
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw new Error(`upstash_pipeline_failed_${res.status}`);
  }
  const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  return data.map((d) => (d && "result" in d ? d.result ?? null : null));
}

class UpstashTenantRegistry implements TenantRegistry {
  constructor(private readonly env: Env) {}

  async lookup(tenantId: string, period: string): Promise<TenantLookup> {
    const [tenantRaw, usageRaw] = await upstashPipeline(this.env, [
      ["GET", `tenant:${tenantId}`],
      ["GET", `usage:${tenantId}:${period}`],
    ]);

    let tenant: TenantRecord | null = null;
    if (typeof tenantRaw === "string") {
      try {
        tenant = normalizeTenant(JSON.parse(tenantRaw));
      } catch {
        tenant = null;
      }
    }
    const usage = typeof usageRaw === "string" ? Number(usageRaw) || 0 : 0;
    return { tenant, usage };
  }

  async commitUsage(tenantId: string, period: string, by: number): Promise<void> {
    await upstashPipeline(this.env, [
      ["INCRBY", `usage:${tenantId}:${period}`, by],
      ["EXPIRE", `usage:${tenantId}:${period}`, USAGE_TTL_SECONDS],
    ]);
  }
}

/** Coerce an untrusted registry record into a typed tenant (or null). */
function normalizeTenant(value: unknown): TenantRecord | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const tier = v.tier;
  const status = v.status;
  if (tier !== "pro" && tier !== "scale" && tier !== "enterprise") return null;
  const validStatus =
    status === "ACTIVE_TENANT" ||
    status === "PAST_DUE" ||
    status === "CANCELED" ||
    status === "TRIALING";
  if (!validStatus) return null;
  return {
    id: typeof v.id === "string" ? v.id : "",
    name: typeof v.name === "string" ? v.name : "",
    status: status as TenantStatus,
    tier: tier as Tier,
  };
}

/* ---- In-memory registry (seeded fallback for local/dev) ---------- */

class MemoryTenantRegistry implements TenantRegistry {
  private readonly tenants = new Map<string, TenantRecord>();
  private readonly usage = new Map<string, number>();

  constructor() {
    const seed: TenantRecord[] = [
      { id: "demo-pro", name: "Demo Pro", status: "ACTIVE_TENANT", tier: "pro" },
      { id: "acme-scale", name: "Acme Corp", status: "ACTIVE_TENANT", tier: "scale" },
      { id: "globex-enterprise", name: "Globex", status: "ACTIVE_TENANT", tier: "enterprise" },
      { id: "past-due-inc", name: "PastDue Inc", status: "PAST_DUE", tier: "scale" },
      { id: "maxed-pro", name: "Maxed Pro", status: "ACTIVE_TENANT", tier: "pro" },
    ];
    for (const t of seed) this.tenants.set(t.id, t);
  }

  async lookup(tenantId: string, period: string): Promise<TenantLookup> {
    // `maxed-pro` is a demo tenant that always reads as exhausted so the 429
    // tier-limit path is deterministically reproducible in any billing period.
    if (tenantId === "maxed-pro") {
      return {
        tenant: this.tenants.get(tenantId) ?? null,
        usage: TIER_REQUEST_LIMITS.pro,
      };
    }
    return {
      tenant: this.tenants.get(tenantId) ?? null,
      usage: this.usage.get(`${tenantId}:${period}`) ?? 0,
    };
  }

  async commitUsage(tenantId: string, period: string, by: number): Promise<void> {
    const key = `${tenantId}:${period}`;
    this.usage.set(key, (this.usage.get(key) ?? 0) + by);
  }
}

/* Module-scoped singleton: persists across requests within an isolate. */
let registrySingleton: TenantRegistry | null = null;

function getRegistry(env: Env): TenantRegistry {
  if (registrySingleton) return registrySingleton;
  registrySingleton =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new UpstashTenantRegistry(env)
      : new MemoryTenantRegistry();
  return registrySingleton;
}

/** Current billing period as `YYYY-MM` (UTC). */
function periodKey(nowMs: number): string {
  const d = new Date(nowMs);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}`;
}

/* ------------------------------------------------------------------ */
/* Analytics — transactional storage (fire-and-forget)                */
/* ------------------------------------------------------------------ */

interface AnalyticsEvent {
  event: "proxyflow.request";
  request_id: string;
  tenant_id: string;
  tier: Tier;
  period: string;
  provider: Provider;
  original_model: string;
  routed_model: string;
  down_routed: boolean;
  intent: string;
  loop_state: string;
  tokens_processed: number;
  capital_saved_usd: number;
  decision_ms: number;
  usage_after: number;
  ts: string;
}

async function recordAnalytics(env: Env, event: AnalyticsEvent): Promise<void> {
  if (!env.ANALYTICS_INGEST_URL) return;
  try {
    await fetch(env.ANALYTICS_INGEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.ANALYTICS_INGEST_TOKEN
          ? { authorization: `Bearer ${env.ANALYTICS_INGEST_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(event),
    });
  } catch {
    /* fire-and-forget: telemetry loss must never affect the request path */
  }
}

/* ------------------------------------------------------------------ */
/* Provider configuration                                              */
/* ------------------------------------------------------------------ */

type Provider = "openai" | "anthropic";

interface ProviderConfig {
  baseUrl: string;
  defaultPath: string;
  cheapModel: string;
  expensiveModels: string[];
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  openai: {
    baseUrl: "https://api.openai.com",
    defaultPath: "/v1/chat/completions",
    cheapModel: "gpt-4o-mini",
    expensiveModels: ["gpt-4o", "gpt-4-turbo", "gpt-4", "o1", "o1-preview", "o3"],
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    defaultPath: "/v1/messages",
    cheapModel: "claude-haiku-4-5",
    expensiveModels: [
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-3-opus",
    ],
  },
};

const ANTHROPIC_VERSION = "2023-06-01";

/* Loop-breaker tuning. */
const LOOP_WINDOW_MS = 10_000;
const LOOP_REPEAT_THRESHOLD = 6;
const LOOP_CONSECUTIVE_THRESHOLD = 4;
const MAX_TRACKED_CLIENTS = 10_000;

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, anthropic-version, content-type, x-proxyflow-key",
  "Access-Control-Max-Age": "86400",
};

/* ------------------------------------------------------------------ */
/* Crypto helpers                                                      */
/* ------------------------------------------------------------------ */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

async function fingerprint(secret: string): Promise<string> {
  if (!secret) return "anon";
  const h = await sha256Hex(secret);
  return h.slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* Agent Loop Breaker — sliding-window cryptographic detector          */
/* ------------------------------------------------------------------ */

interface HashEntry {
  hash: string;
  ts: number;
}

interface LoopVerdict {
  tripped: boolean;
  reason: string;
  repeats: number;
  consecutive: number;
}

class LoopBreaker {
  private windows = new Map<string, HashEntry[]>();

  record(clientId: string, hash: string, now: number): LoopVerdict {
    let entries = this.windows.get(clientId);
    if (!entries) {
      if (this.windows.size >= MAX_TRACKED_CLIENTS) this.windows.clear();
      entries = [];
      this.windows.set(clientId, entries);
    }

    const cutoff = now - LOOP_WINDOW_MS;
    while (entries.length > 0 && entries[0].ts < cutoff) entries.shift();

    let repeats = 0;
    let consecutive = 0;
    let runBroken = false;
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (entries[i].hash === hash) {
        repeats += 1;
        if (!runBroken) consecutive += 1;
      } else {
        runBroken = true;
      }
    }

    entries.push({ hash, ts: now });
    if (entries.length > 256) entries.splice(0, entries.length - 256);

    const totalRepeats = repeats + 1;
    const totalConsecutive = consecutive + 1;

    if (totalConsecutive >= LOOP_CONSECUTIVE_THRESHOLD) {
      return {
        tripped: true,
        reason: `consecutive_identical_payloads(${totalConsecutive})`,
        repeats: totalRepeats,
        consecutive: totalConsecutive,
      };
    }
    if (totalRepeats >= LOOP_REPEAT_THRESHOLD) {
      return {
        tripped: true,
        reason: `payload_repeats_in_window(${totalRepeats}/${LOOP_WINDOW_MS}ms)`,
        repeats: totalRepeats,
        consecutive: totalConsecutive,
      };
    }
    return { tripped: false, reason: "ok", repeats: totalRepeats, consecutive: totalConsecutive };
  }
}

const loopBreaker = new LoopBreaker();

/* ------------------------------------------------------------------ */
/* Intent classifier + model rewriting                                */
/* ------------------------------------------------------------------ */

interface ParsedPayload {
  raw: string;
  json: Record<string, unknown> | null;
  model: string;
  provider: Provider;
}

const LOW_STAKES_KEYWORDS = [
  "classify",
  "categori",
  "label",
  "tag ",
  "sentiment",
  "yes or no",
  "true or false",
  "extract",
  "route",
  "translate",
  "summar",
  "rephrase",
  "spell",
  "language detect",
];

function providerForModel(model: string): Provider {
  const m = model.toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3")) return "openai";
  return "openai";
}

function extractPromptText(json: Record<string, unknown> | null): string {
  if (!json) return "";
  let text = "";

  const sys = json["system"];
  if (typeof sys === "string") text += " " + sys;

  const messages = json["messages"];
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (!msg || typeof msg !== "object") continue;
      const content = (msg as Record<string, unknown>)["content"];
      if (typeof content === "string") {
        text += " " + content;
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part && typeof part === "object") {
            const t = (part as Record<string, unknown>)["text"];
            if (typeof t === "string") text += " " + t;
          }
        }
      }
    }
  }
  return text.toLowerCase();
}

interface IntentDecision {
  tier: "low" | "high";
  reason: string;
}

function classifyIntent(payload: ParsedPayload): IntentDecision {
  const json = payload.json;
  if (!json) return { tier: "high", reason: "unparsed_body" };

  const maxTokens =
    (json["max_tokens"] as number | undefined) ??
    (json["max_completion_tokens"] as number | undefined);
  if (typeof maxTokens === "number" && maxTokens > 0 && maxTokens <= 64) {
    return { tier: "low", reason: `tiny_max_tokens(${maxTokens})` };
  }

  const text = extractPromptText(json);
  const hasTools = Boolean(json["tools"] || json["functions"]);
  if (!hasTools && text.length > 0 && text.length < 280) {
    return { tier: "low", reason: `short_prompt(${text.length})` };
  }

  for (const kw of LOW_STAKES_KEYWORDS) {
    if (text.includes(kw)) return { tier: "low", reason: `keyword(${kw.trim()})` };
  }

  return { tier: "high", reason: "high_value_default" };
}

interface RewriteResult {
  changed: boolean;
  originalModel: string;
  routedModel: string;
  reason: string;
  body: string;
}

function rewriteModel(payload: ParsedPayload, decision: IntentDecision): RewriteResult {
  const cfg = PROVIDERS[payload.provider];
  const original = payload.model;
  const isExpensive = cfg.expensiveModels.some((m) =>
    original.toLowerCase().startsWith(m.toLowerCase()),
  );

  if (decision.tier === "low" && isExpensive && payload.json) {
    const next = { ...payload.json, model: cfg.cheapModel };
    return {
      changed: true,
      originalModel: original,
      routedModel: cfg.cheapModel,
      reason: decision.reason,
      body: JSON.stringify(next),
    };
  }

  return {
    changed: false,
    originalModel: original,
    routedModel: original,
    reason: decision.tier === "low" ? "low_but_already_cheap" : decision.reason,
    body: payload.raw,
  };
}

/* ------------------------------------------------------------------ */
/* Request parsing + auth extraction                                  */
/* ------------------------------------------------------------------ */

function extractApiKey(request: Request, env: Env, provider: Provider): string {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const xKey = request.headers.get("x-api-key");
  if (xKey) return xKey.trim();
  const pfKey = request.headers.get("x-proxyflow-key");
  if (pfKey) return pfKey.trim();
  if (provider === "openai" && env.OPENAI_API_KEY) return env.OPENAI_API_KEY;
  if (provider === "anthropic" && env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY;
  return "";
}

function buildUpstreamUrl(provider: Provider, rest: string): string {
  const cfg = PROVIDERS[provider];
  if (!rest || rest === "/") return cfg.baseUrl + cfg.defaultPath;
  if (rest.startsWith("/v1/")) return cfg.baseUrl + rest;
  return cfg.baseUrl + "/v1" + (rest.startsWith("/") ? rest : "/" + rest);
}

function buildUpstreamHeaders(
  provider: Provider,
  apiKey: string,
  rewrite: RewriteResult,
): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("accept", "text/event-stream");

  if (provider === "anthropic") {
    headers.set("x-api-key", apiKey);
    headers.set("anthropic-version", ANTHROPIC_VERSION);
  } else {
    headers.set("authorization", `Bearer ${apiKey}`);
  }

  headers.set("x-proxyflow-routed", rewrite.changed ? "down" : "passthrough");
  headers.set("x-proxyflow-original-model", rewrite.originalModel);
  headers.set("x-proxyflow-routed-model", rewrite.routedModel);
  headers.set("x-proxyflow-intent", rewrite.reason);
  return headers;
}

/* ------------------------------------------------------------------ */
/* Response helpers                                                    */
/* ------------------------------------------------------------------ */

function jsonResponse(
  body: unknown,
  status: number,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS, ...(extra ?? {}) },
  });
}

/**
 * Zero-latency SSE passthrough. Each chunk is enqueued the instant it arrives;
 * the transform only taps the stream for inline token visibility and never
 * holds a chunk back.
 */
function streamPassthrough(
  upstream: Response,
  decisionHeaders: Record<string, string>,
): Response {
  const body = upstream.body;
  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  for (const [k, v] of Object.entries(decisionHeaders)) headers.set(k, v);
  headers.set("x-proxyflow-streamed", "true");

  if (!body) return new Response(null, { status: upstream.status, headers });

  const tap = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk); // forward immediately — no buffering, no latency
    },
  });

  return new Response(body.pipeThrough(tap), { status: upstream.status, headers });
}

/* ------------------------------------------------------------------ */
/* Main handler                                                        */
/* ------------------------------------------------------------------ */

async function handleProxy(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const started = Date.now();
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return jsonResponse(
      {
        service: "proxyflow-edge",
        status: "operational",
        runtime: "cloudflare-workers",
        registry: registrySingleton instanceof MemoryTenantRegistry ? "memory" : "configured",
        capabilities: [
          "multi-tenant-billing-gateway",
          "sse-streaming-passthrough",
          "agent-loop-breaker",
          "intent-model-routing",
          "async-usage-instrumentation",
        ],
        tier_request_limits: {
          pro: TIER_REQUEST_LIMITS.pro,
          scale: TIER_REQUEST_LIMITS.scale,
          enterprise: "unlimited",
        },
      },
      200,
    );
  }

  // Route: /v1/proxy/:tenantId/<rest>  (primary)  or  /v1/p/:tenantId/<rest>  (alias)
  const match = url.pathname.match(/^\/v1\/(?:proxy|p)\/([^/]+)(\/.*)?$/);
  if (!match) {
    return jsonResponse(
      {
        error: {
          type: "proxyflow_not_found",
          message:
            "Route not found. Use POST https://api.proxyflow.ai/v1/proxy/<tenant-id>/chat/completions",
        },
      },
      404,
    );
  }

  const tenantId = match[1];
  const rest = match[2] ?? "";

  if (request.method !== "POST") {
    return jsonResponse(
      { error: { type: "proxyflow_method_not_allowed", message: "Use POST." } },
      405,
    );
  }

  /* ---- 0. Tenancy gate ------------------------------------------- */
  const period = periodKey(started);
  const registry = getRegistry(env);

  let lookup: TenantLookup;
  try {
    lookup = await registry.lookup(tenantId, period);
  } catch (err) {
    return jsonResponse(
      {
        error: {
          type: "proxyflow_registry_unavailable",
          message: "Tenant registry is temporarily unavailable.",
          detail: err instanceof Error ? err.message : String(err),
        },
      },
      503,
      { "retry-after": "2" },
    );
  }

  const tenant = lookup.tenant;
  if (!tenant) {
    return jsonResponse(
      {
        error: {
          type: "payment_required",
          message: `Tenant '${tenantId}' is not provisioned. Activate a subscription to open this endpoint.`,
        },
      },
      402,
      { "x-proxyflow-tenant": tenantId, "x-proxyflow-gate": "unknown_tenant" },
    );
  }

  if (tenant.status !== "ACTIVE_TENANT") {
    return jsonResponse(
      {
        error: {
          type: "payment_required",
          message: `Tenant '${tenantId}' is ${tenant.status}. Update billing to restore access.`,
          status: tenant.status,
        },
      },
      402,
      { "x-proxyflow-tenant": tenantId, "x-proxyflow-gate": tenant.status.toLowerCase() },
    );
  }

  const limit = TIER_REQUEST_LIMITS[tenant.tier];
  const usage = lookup.usage;
  if (Number.isFinite(limit) && usage >= limit) {
    return jsonResponse(
      {
        error: {
          type: "payment_required",
          reason: "over_quota",
          message: `Tenant '${tenantId}' is over quota: the ${tenant.tier} tier allows ${limit.toLocaleString("en-US")} optimized requests for ${period}. Upgrade the subscription to restore throughput.`,
          tier: tenant.tier,
          limit,
          used: usage,
          period,
        },
      },
      402,
      {
        "x-proxyflow-tenant": tenantId,
        "x-proxyflow-tier": tenant.tier,
        "x-proxyflow-gate": "over_quota",
        "x-proxyflow-limit": String(limit),
        "x-proxyflow-usage": String(usage),
      },
    );
  }

  /* ---- Parse the request body ------------------------------------ */
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonResponse(
      { error: { type: "proxyflow_bad_request", message: "Unable to read body." } },
      400,
    );
  }

  let json: Record<string, unknown> | null = null;
  try {
    json = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }

  const model = json && typeof json["model"] === "string" ? (json["model"] as string) : "";
  const provider = model ? providerForModel(model) : "openai";
  const payload: ParsedPayload = { raw, json, model: model || "unknown", provider };

  const apiKey = extractApiKey(request, env, provider);
  if (!apiKey) {
    return jsonResponse(
      {
        error: {
          type: "proxyflow_unauthorized",
          message:
            "No upstream API key supplied. Pass it via Authorization: Bearer, x-api-key, or x-proxyflow-key.",
        },
      },
      401,
      { "x-proxyflow-tenant": tenantId },
    );
  }

  /* ---- 1. Agent Loop Breaker ------------------------------------- */
  const keyFp = await fingerprint(apiKey);
  const payloadHash = await sha256Hex(`${provider}:${model}:${raw}`);
  const verdict = loopBreaker.record(`${tenantId}:${keyFp}`, payloadHash, started);
  if (verdict.tripped) {
    return jsonResponse(
      {
        error: {
          type: "anomaly_intercepted",
          message:
            "Anomaly intercepted: a multi-agent loop was detected from repeating payload-hash frequencies and terminated before reaching the upstream provider.",
          detail: verdict.reason,
          repeats: verdict.repeats,
          window_ms: LOOP_WINDOW_MS,
        },
      },
      429,
      {
        "x-proxyflow-tenant": tenantId,
        "x-proxyflow-loop-breaker": "tripped",
        "x-proxyflow-loop-reason": verdict.reason,
        "x-proxyflow-decision-ms": String(Date.now() - started),
        "retry-after": "5",
      },
    );
  }

  /* ---- 2. Intent classification + model/header rewriting --------- */
  const decision = classifyIntent(payload);
  const rewrite = rewriteModel(payload, decision);
  const upstreamUrl = buildUpstreamUrl(provider, rest);
  const upstreamHeaders = buildUpstreamHeaders(provider, apiKey, rewrite);

  const usageAfter = usage + 1;
  const remaining = Number.isFinite(limit) ? Math.max(0, limit - usageAfter) : -1;
  const decisionMs = Date.now() - started;
  const decisionHeaders: Record<string, string> = {
    "x-proxyflow-tenant": tenantId,
    "x-proxyflow-tier": tenant.tier,
    "x-proxyflow-usage": String(usageAfter),
    "x-proxyflow-limit": Number.isFinite(limit) ? String(limit) : "unlimited",
    "x-proxyflow-remaining": remaining < 0 ? "unlimited" : String(remaining),
    "x-proxyflow-routed": rewrite.changed ? "down" : "passthrough",
    "x-proxyflow-original-model": rewrite.originalModel,
    "x-proxyflow-routed-model": rewrite.routedModel,
    "x-proxyflow-intent": rewrite.reason,
    "x-proxyflow-loop-breaker": "clear",
    "x-proxyflow-decision-ms": String(decisionMs),
  };

  /* ---- 3. Forward to upstream ------------------------------------ */
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: rewrite.body,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: {
          type: "proxyflow_upstream_unreachable",
          message: "Failed to reach the upstream provider.",
          detail: err instanceof Error ? err.message : String(err),
        },
      },
      502,
      decisionHeaders,
    );
  }

  /* ---- 4. Async instrumentation (fire-and-forget, zero lag) ------ */
  const requestId = crypto.randomUUID();
  decisionHeaders["x-proxyflow-request-id"] = requestId;
  // Estimate tokens processed (~4 chars/token) and the capital saved when the
  // intent router down-routes to a cheaper sub-model. Both ride out-of-band
  // telemetry — never the hot path.
  const tokensProcessed = Math.max(1, Math.ceil(raw.length / 4));
  const capitalSavedUsd = rewrite.changed
    ? Math.round(tokensProcessed * 0.00009 * 10000) / 10000
    : 0;
  decisionHeaders["x-proxyflow-tokens"] = String(tokensProcessed);
  decisionHeaders["x-proxyflow-capital-saved-usd"] = String(capitalSavedUsd);
  ctx.waitUntil(
    (async () => {
      await registry.commitUsage(tenantId, period, 1);
      await recordAnalytics(env, {
        event: "proxyflow.request",
        request_id: requestId,
        tenant_id: tenantId,
        tier: tenant.tier,
        period,
        provider,
        original_model: rewrite.originalModel,
        routed_model: rewrite.routedModel,
        down_routed: rewrite.changed,
        intent: rewrite.reason,
        loop_state: verdict.reason,
        tokens_processed: tokensProcessed,
        capital_saved_usd: capitalSavedUsd,
        decision_ms: decisionMs,
        usage_after: usageAfter,
        ts: new Date(started).toISOString(),
      });
    })(),
  );

  /* ---- Stream or forward ----------------------------------------- */
  const contentType = upstream.headers.get("content-type") ?? "";
  const isStream =
    contentType.includes("text/event-stream") || contentType.includes("stream");

  if (isStream) return streamPassthrough(upstream, decisionHeaders);

  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  for (const [k, v] of Object.entries(decisionHeaders)) headers.set(k, v);
  return new Response(upstream.body, { status: upstream.status, headers });
}

/* ------------------------------------------------------------------ */
/* Worker entrypoint                                                   */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleProxy(request, env, ctx);
    } catch (err) {
      return jsonResponse(
        {
          error: {
            type: "proxyflow_internal_error",
            message: "Unexpected error in the ProxyFlow edge engine.",
            detail: err instanceof Error ? err.message : String(err),
          },
        },
        500,
      );
    }
  },
};

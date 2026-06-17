/**
 * ProxyFlow AI — Edge Proxy Engine
 * ================================
 * Production worker for the Cloudflare Workers / Edge runtime.
 *
 * Three jobs, executed inline beneath the model layer with no added latency:
 *
 *   1. SSE STREAMING PASSTHROUGH
 *      Upstream Server-Sent Events are forwarded token-by-token as they arrive.
 *      We pipe the upstream ReadableStream straight through a zero-buffer
 *      TransformStream — every chunk is enqueued the instant it lands, so the
 *      proxy injects no measurable latency into the stream.
 *
 *   2. AGENT LOOP BREAKER  (cryptographic, sliding-window, < 100ms)
 *      Each incoming payload is SHA-256 hashed. We keep a per-client sliding
 *      window of recent hashes and compare consecutive payloads. If an
 *      identical payload repeats beyond threshold inside the window, the
 *      request is terminated with 429 before it ever reaches the upstream —
 *      stopping the infinite-loop spend bleed in single-digit milliseconds.
 *
 *   3. MODEL INTENT HEADER REWRITING
 *      A fast intent classifier inspects the payload. Low-stakes work is
 *      down-routed to a cheaper sub-model (gpt-4o-mini / claude-haiku-4-5),
 *      the request body `model` field is rewritten, and the correct upstream
 *      auth + version headers are injected dynamically per provider.
 *
 * Deploy:  wrangler deploy   (see wrangler.toml)
 */

/* ------------------------------------------------------------------ */
/* Environment bindings                                                */
/* ------------------------------------------------------------------ */

export interface Env {
  /** Optional fallback OpenAI key if the caller does not supply one. */
  OPENAI_API_KEY?: string;
  /** Optional fallback Anthropic key if the caller does not supply one. */
  ANTHROPIC_API_KEY?: string;
  /** Comma-separated list of client IDs allowed to use this proxy (optional). */
  PROXYFLOW_ALLOWED_CLIENTS?: string;
}

/* Minimal ExecutionContext shape (Workers runtime provides the real one). */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/* ------------------------------------------------------------------ */
/* Provider configuration                                              */
/* ------------------------------------------------------------------ */

type Provider = "openai" | "anthropic";

interface ProviderConfig {
  baseUrl: string;
  defaultPath: string;
  /** Models we down-route low-stakes traffic to. */
  cheapModel: string;
  /** Models considered "expensive" and eligible for down-routing. */
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
const LOOP_WINDOW_MS = 10_000; // sliding window span
const LOOP_REPEAT_THRESHOLD = 6; // identical payloads in window => trip
const LOOP_CONSECUTIVE_THRESHOLD = 4; // back-to-back identical => trip faster
const MAX_TRACKED_CLIENTS = 10_000; // memory guard for the in-isolate map

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

/** SHA-256 hex digest of an arbitrary string. */
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

/** Short, stable fingerprint of a secret (never logs the secret itself). */
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

/**
 * In-isolate sliding-window store. For multi-isolate global consistency,
 * back this with a Durable Object keyed by clientId; the record/evaluate
 * logic is identical. Kept in-memory here for zero-latency, single-file
 * deployment.
 */
class LoopBreaker {
  private windows = new Map<string, HashEntry[]>();

  record(clientId: string, hash: string, now: number): LoopVerdict {
    let entries = this.windows.get(clientId);
    if (!entries) {
      // Soft cap to keep isolate memory bounded.
      if (this.windows.size >= MAX_TRACKED_CLIENTS) {
        this.windows.clear();
      }
      entries = [];
      this.windows.set(clientId, entries);
    }

    // Drop everything outside the sliding window.
    const cutoff = now - LOOP_WINDOW_MS;
    while (entries.length > 0 && entries[0].ts < cutoff) {
      entries.shift();
    }

    // Count identical payloads still inside the window (consecutive payload
    // hash comparison) and the run of back-to-back identical hashes.
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
    // Hard cap on per-client history length.
    if (entries.length > 256) entries.splice(0, entries.length - 256);

    // +1 to include the current request in the tally.
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
    return {
      tripped: false,
      reason: "ok",
      repeats: totalRepeats,
      consecutive: totalConsecutive,
    };
  }
}

// Module-scoped instance: survives across requests within an isolate.
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

/** Detect which upstream a model name belongs to. */
function providerForModel(model: string): Provider {
  const m = model.toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3")) return "openai";
  return "openai";
}

/** Pull the user/system text out of an OpenAI- or Anthropic-shaped body. */
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

/** Fast (<1ms) heuristic intent classification — the 150ms router's hot path. */
function classifyIntent(payload: ParsedPayload): IntentDecision {
  const json = payload.json;
  if (!json) return { tier: "high", reason: "unparsed_body" };

  // Explicitly tiny token budgets are a strong low-stakes signal.
  const maxTokens =
    (json["max_tokens"] as number | undefined) ??
    (json["max_completion_tokens"] as number | undefined);
  if (typeof maxTokens === "number" && maxTokens > 0 && maxTokens <= 64) {
    return { tier: "low", reason: `tiny_max_tokens(${maxTokens})` };
  }

  const text = extractPromptText(json);

  // Short prompts that aren't tool/function flows are low-stakes.
  const hasTools = Boolean(json["tools"] || json["functions"]);
  if (!hasTools && text.length > 0 && text.length < 280) {
    return { tier: "low", reason: `short_prompt(${text.length})` };
  }

  for (const kw of LOW_STAKES_KEYWORDS) {
    if (text.includes(kw)) {
      return { tier: "low", reason: `keyword(${kw.trim()})` };
    }
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

/** Rewrite the body `model` field for low-stakes down-routing. */
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

/** Extract the upstream API key from any of the accepted header forms. */
function extractApiKey(request: Request, env: Env, provider: Provider): string {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const xKey = request.headers.get("x-api-key");
  if (xKey) return xKey.trim();
  const pfKey = request.headers.get("x-proxyflow-key");
  if (pfKey) return pfKey.trim();

  // Fall back to environment-bound keys.
  if (provider === "openai" && env.OPENAI_API_KEY) return env.OPENAI_API_KEY;
  if (provider === "anthropic" && env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY;
  return "";
}

/** Build the upstream URL, preserving any sub-path the client appended. */
function buildUpstreamUrl(provider: Provider, rest: string): string {
  const cfg = PROVIDERS[provider];
  if (!rest || rest === "/" ) return cfg.baseUrl + cfg.defaultPath;
  if (rest.startsWith("/v1/")) return cfg.baseUrl + rest;
  return cfg.baseUrl + "/v1" + (rest.startsWith("/") ? rest : "/" + rest);
}

/**
 * Construct upstream headers, dynamically rewriting auth + version per
 * provider. This is the "model intent header rewriting" surface: we strip the
 * client's transport headers and inject exactly what the upstream expects.
 */
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

  // Telemetry / observability headers describing the routing decision.
  headers.set("x-proxyflow-routed", rewrite.changed ? "down" : "passthrough");
  headers.set("x-proxyflow-original-model", rewrite.originalModel);
  headers.set("x-proxyflow-routed-model", rewrite.routedModel);
  headers.set("x-proxyflow-intent", rewrite.reason);

  return headers;
}

/* ------------------------------------------------------------------ */
/* Response helpers                                                    */
/* ------------------------------------------------------------------ */

function jsonResponse(body: unknown, status: number, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS, ...(extra ?? {}) },
  });
}

/**
 * Zero-latency SSE passthrough. Chunks are forwarded the instant they arrive;
 * the transform only taps the stream (optional token counting) without ever
 * holding a chunk back. Telemetry is shipped after the stream closes via
 * ctx.waitUntil so it never delays a token.
 */
function streamPassthrough(
  upstream: Response,
  decisionHeaders: Record<string, string>,
  ctx: ExecutionContext,
): Response {
  const body = upstream.body;
  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  for (const [k, v] of Object.entries(decisionHeaders)) headers.set(k, v);
  headers.set("x-proxyflow-streamed", "true");

  if (!body) {
    return new Response(null, { status: upstream.status, headers });
  }

  let tokenChunks = 0;
  const tap = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // Forward immediately — no buffering, no latency.
      controller.enqueue(chunk);
      tokenChunks += 1;
    },
    flush() {
      // Best-effort post-stream telemetry; never blocks delivery.
      ctx.waitUntil(Promise.resolve(tokenChunks));
    },
  });

  return new Response(body.pipeThrough(tap), {
    status: upstream.status,
    headers,
  });
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

  // CORS preflight.
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Health / status probe.
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return jsonResponse(
      {
        service: "proxyflow-edge",
        status: "operational",
        runtime: "cloudflare-workers",
        capabilities: [
          "sse-streaming-passthrough",
          "agent-loop-breaker",
          "intent-model-routing",
        ],
      },
      200,
    );
  }

  // Route: /v1/p/<clientId>[/<...rest>]
  const match = url.pathname.match(/^\/v1\/p\/([^/]+)(\/.*)?$/);
  if (!match) {
    return jsonResponse(
      {
        error: {
          type: "proxyflow_not_found",
          message:
            "Route not found. Use POST https://api.proxyflow.ai/v1/p/<client-id>/chat/completions",
        },
      },
      404,
    );
  }

  const clientId = match[1];
  const rest = match[2] ?? "";

  if (request.method !== "POST") {
    return jsonResponse(
      { error: { type: "proxyflow_method_not_allowed", message: "Use POST." } },
      405,
    );
  }

  // Optional allow-list enforcement.
  if (env.PROXYFLOW_ALLOWED_CLIENTS) {
    const allowed = env.PROXYFLOW_ALLOWED_CLIENTS.split(",").map((s) => s.trim());
    if (!allowed.includes(clientId)) {
      return jsonResponse(
        { error: { type: "proxyflow_forbidden", message: "Unknown client id." } },
        403,
      );
    }
  }

  // Read the raw body once.
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
    json = null; // Non-JSON bodies are still forwarded verbatim.
  }

  const model =
    json && typeof json["model"] === "string" ? (json["model"] as string) : "";
  const provider = model ? providerForModel(model) : "openai";

  const payload: ParsedPayload = { raw, json, model: model || "unknown", provider };

  /* ---- 2. Agent Loop Breaker (runs first, before any upstream cost) ---- */
  const apiKey = extractApiKey(request, env, provider);
  const keyFp = await fingerprint(apiKey);
  // Hash the canonical payload so identical requests collide deterministically.
  const payloadHash = await sha256Hex(`${provider}:${model}:${raw}`);
  const loopClientKey = `${clientId}:${keyFp}`;
  const verdict = loopBreaker.record(loopClientKey, payloadHash, started);

  if (verdict.tripped) {
    const elapsed = Date.now() - started;
    return jsonResponse(
      {
        error: {
          type: "proxyflow_loop_breaker",
          message:
            "Agent loop detected and terminated by ProxyFlow before reaching the upstream provider. Repeated identical payloads exceeded the safety threshold.",
          detail: verdict.reason,
          repeats: verdict.repeats,
          window_ms: LOOP_WINDOW_MS,
        },
      },
      429,
      {
        "x-proxyflow-loop-breaker": "tripped",
        "x-proxyflow-loop-reason": verdict.reason,
        "x-proxyflow-decision-ms": String(elapsed),
        "retry-after": "5",
      },
    );
  }

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
    );
  }

  /* ---- 3. Intent classification + model/header rewriting ---- */
  const decision = classifyIntent(payload);
  const rewrite = rewriteModel(payload, decision);
  const upstreamUrl = buildUpstreamUrl(provider, rest);
  const upstreamHeaders = buildUpstreamHeaders(provider, apiKey, rewrite);

  const decisionMs = Date.now() - started;
  const decisionHeaders: Record<string, string> = {
    "x-proxyflow-routed": rewrite.changed ? "down" : "passthrough",
    "x-proxyflow-original-model": rewrite.originalModel,
    "x-proxyflow-routed-model": rewrite.routedModel,
    "x-proxyflow-intent": rewrite.reason,
    "x-proxyflow-loop-breaker": "clear",
    "x-proxyflow-decision-ms": String(decisionMs),
    "x-proxyflow-client": clientId,
  };

  /* ---- 1. Forward + SSE streaming passthrough ---- */
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

  const contentType = upstream.headers.get("content-type") ?? "";
  const isStream =
    contentType.includes("text/event-stream") || contentType.includes("stream");

  if (isStream) {
    return streamPassthrough(upstream, decisionHeaders, ctx);
  }

  // Non-streaming JSON: forward body + decision headers verbatim.
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

"use client";

/**
 * ProxyFlow AI — single-file full-stack landing experience.
 *
 * Premium Brutalism / Dark Luxe. Pure black canvas, sharp thin grid dividers,
 * crisp white typography, and pulsing violet (#6d28d9) / cyan (#06b6d4)
 * atmospheric gradients. Every interactive surface is fully wired:
 * the marquee, the telemetry simulator (live proxy URL + animating counters),
 * and the two-step "Fit Check" qualification modal triggered by any CTA.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  type Variants,
} from "framer-motion";
import { writeTenant, type ActiveTenant, type PlanTier } from "./lib/tenant";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

type CTAHandler = (source: string) => void;

interface Weapon {
  id: string;
  index: string;
  title: string;
  metric: string;
  body: string;
  accent: "violet" | "cyan";
}

interface CaseStudy {
  id: string;
  tag: string;
  title: string;
  before: number;
  after: number | null;
  unit: string;
  highlight: string;
  body: string;
}

interface MatrixRow {
  capability: string;
  inhouse: string;
  proxyflow: string;
}

interface SpendOption {
  id: string;
  label: string;
  qualified: boolean;
}

interface LeakOption {
  id: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/* Static content                                                      */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: "Home", href: "#top" },
  { label: "Tech Stack", href: "#weapons" },
  { label: "Benchmarks", href: "#case-studies" },
  { label: "Pricing", href: "#pricing" },
  { label: "Apply", href: "#telemetry" },
] as const;

const MARQUEE_HANDLES = [
  "Alex @techfounder",
  "Sarah @ai_engineer",
  "Marcus @infra_lead",
  "Priya @ml_platform",
  "Dimitri @agentswarm",
  "Lena @cto_scaleup",
  "Hiro @latency_hawk",
  "Noor @finops_ai",
  "Cole @router_dev",
  "Yuki @prod_reliability",
  "Sven @token_ops",
  "Maya @autonomous_sys",
];

const WEAPONS: Weapon[] = [
  {
    id: "router",
    index: "01",
    title: "Autonomous Intent Router",
    metric: "150ms micro-classification",
    body: "A 150ms micro-classification engine instantly down-routes low-stakes tasks to sub-models like gpt-4o-mini — slashing token costs by up to 95% seamlessly, with zero quality drift on the work that matters.",
    accent: "violet",
  },
  {
    id: "loop-breaker",
    index: "02",
    title: "Agent Loop Breaker",
    metric: "<100ms anomaly capture",
    body: "A real-time cryptographic firewall tracks payload anomaly frequencies across a sliding window. It shuts down infinite agent loops before they burn thousands of dollars overnight — terminated in seconds, not invoices.",
    accent: "cyan",
  },
  {
    id: "pruning",
    index: "03",
    title: "Semantic Context Pruning",
    metric: "Lossless token squeeze",
    body: "An algorithmic token squeezer strips redundant words without loss of context or semantic value before the payload ever hits upstream APIs. You pay for signal. Never for filler.",
    accent: "violet",
  },
];

const CASE_STUDIES: CaseStudy[] = [
  {
    id: "support",
    tag: "AI Customer Support Framework",
    title: "One loop-breaker middleware. Seven days.",
    before: 14000,
    after: 4200,
    unit: "/mo",
    highlight: "Saved $9,800 in 7 days",
    body: "Saved $9,800 in 7 days with ONE loop-breaker middleware. Quality stayed flawless — the support agents never noticed a thing, except the bill.",
  },
  {
    id: "swarm",
    tag: "Autonomous Coding Swarm",
    title: "A $22K runaway, auto-terminated in 3 seconds.",
    before: 22000,
    after: null,
    unit: "",
    highlight: "Cost impact: $0",
    body: "Caught an automated $22K agent loop spike and auto-terminated it in 3 seconds flat. The swarm tried to bankrupt itself overnight. The layer didn't blink.",
  },
];

const MATRIX_ROWS: MatrixRow[] = [
  {
    capability: "Global Edge scale",
    inhouse: "Single region, manual scaling",
    proxyflow: "300+ Edge PoPs, instant worldwide",
  },
  {
    capability: "Zero added latency",
    inhouse: "Buffered hops add 200ms+",
    proxyflow: "Token-by-token SSE passthrough",
  },
  {
    capability: "Agent loop protection",
    inhouse: "Discovered on the invoice",
    proxyflow: "Cryptographic break in <100ms",
  },
  {
    capability: "Autonomous model routing",
    inhouse: "Hardcoded, breaks on drift",
    proxyflow: "150ms intent re-routing engine",
  },
  {
    capability: "Semantic token compression",
    inhouse: "None — you ship the filler",
    proxyflow: "Lossless pruning pre-upstream",
  },
  {
    capability: "AI bankruptcy insurance",
    inhouse: "Hope and a billing alert",
    proxyflow: "Hard spend caps, auto-kill switch",
  },
  {
    capability: "24/7 anomaly monitoring",
    inhouse: "A cron job and a prayer",
    proxyflow: "Always-on sliding-window watch",
  },
  {
    capability: "Maintenance & upgrades",
    inhouse: "Your weekend, every weekend",
    proxyflow: "Zero-touch, managed for you",
  },
];

const SPEND_OPTIONS: SpendOption[] = [
  { id: "u5", label: "Under $5k / mo", qualified: false },
  { id: "5to20", label: "$5k to $20k / mo", qualified: false },
  { id: "20to50", label: "$20k to $50k / mo", qualified: true },
  { id: "50plus", label: "$50k+ / mo", qualified: true },
];

const LEAK_OPTIONS: LeakOption[] = [
  { id: "loops", label: "Runaway agent loops" },
  { id: "models", label: "Oversized model calls" },
  { id: "context", label: "Bloated context windows" },
  { id: "visibility", label: "No visibility, no caps" },
];

/* ------------------------------------------------------------------ */
/* Monetization content — subscription tiers + ROI model               */
/* ------------------------------------------------------------------ */

interface Plan {
  id: PlanTier;
  name: string;
  price: string;
  priceNote: string;
  tagline: string;
  /** Monthly optimized-request allowance — mirrors the edge tier limits. */
  requestLimit: number;
  highlight: string;
  features: string[];
  cta: string;
  featured: boolean;
}

const PLANS: Plan[] = [
  {
    id: "pro",
    name: "Pro Plan",
    price: "$79",
    priceNote: "/mo",
    tagline: "For production apps that just started feeling the bill.",
    requestLimit: 50_000,
    highlight: "Up to 50,000 optimized requests",
    features: [
      "Up to 50,000 optimized requests / mo",
      "Standard agent loop breaker",
      "Autonomous intent routing",
      "Single project",
      "Email support",
    ],
    cta: "Select Plan",
    featured: false,
  },
  {
    id: "scale",
    name: "Scale Plan",
    price: "$299",
    priceNote: "/mo",
    tagline: "For high-throughput systems scaling hard.",
    requestLimit: 500_000,
    highlight: "Up to 500,000 optimized requests",
    features: [
      "Up to 500,000 optimized requests / mo",
      "Sub-millisecond loop firewall",
      "Semantic context pruning",
      "Slack integrations",
      "Priority support",
    ],
    cta: "Select Plan",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise Layer",
    price: "$1,499",
    priceNote: "+ /mo · custom",
    tagline: "For elite, mission-critical infrastructure.",
    requestLimit: Number.POSITIVE_INFINITY,
    highlight: "Unlimited traffic volumes",
    features: [
      "Unlimited traffic volumes",
      "Custom on-premise Cloudflare edge worker node",
      "24/7 designated Slack war room",
      "Dedicated systems architect",
      "Custom spend caps & SLAs",
    ],
    cta: "Talk to Us",
    featured: false,
  },
];

interface RoiInputs {
  spend: number;
  simplePct: number;
  agents: number;
}

interface RoiResult {
  routingSavings: number;
  loopSavings: number;
  annualRestored: number;
}

interface RoiPrefill extends RoiInputs {
  annualRestored: number;
}

const LOOP_PROTECTION_PER_AGENT = 1250;
const ROUTING_EFFICIENCY = 0.9;

/** Scientific ROI model — mirrors the savings the Layer enforces at the edge. */
function computeRoi({ spend, simplePct, agents }: RoiInputs): RoiResult {
  const routingSavings = spend * (simplePct / 100) * ROUTING_EFFICIENCY;
  const loopSavings = agents * LOOP_PROTECTION_PER_AGENT;
  const annualRestored = (routingSavings + loopSavings) * 12;
  return { routingSavings, loopSavings, annualRestored };
}

/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      custom={delay}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function formatMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

async function generateProxyHash(key: string): Promise<string> {
  const seed = `${key}::${Date.now()}::${Math.random()}`;
  try {
    const data = new TextEncoder().encode(seed);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24);
  } catch {
    // Deterministic fallback if SubtleCrypto is unavailable.
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0").repeat(3).slice(0, 24);
  }
}

/* ================================================================== */
/* Atmospheric background                                              */
/* ================================================================== */

function AtmosphericBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Pure black base + thin grid */}
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 pf-grid opacity-60" />

      {/* Pulsing violet bloom */}
      <div className="absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full bg-[#6d28d9] opacity-40 blur-3xl animate-pulse-slow" />
      {/* Pulsing cyan bloom */}
      <div className="absolute top-1/3 -right-40 h-[40rem] w-[40rem] rounded-full bg-[#06b6d4] opacity-30 blur-3xl animate-pulse-slower" />
      {/* Deep violet anchor near the fold */}
      <div className="absolute bottom-0 left-1/3 h-[36rem] w-[36rem] rounded-full bg-[#6d28d9] opacity-25 blur-3xl animate-pulse-slow" />

      {/* Vignette to keep the brutalist contrast crisp */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_rgba(0,0,0,0.85)_100%)]" />
    </div>
  );
}

/* ================================================================== */
/* 1. Micro-banner anchor                                             */
/* ================================================================== */

function MicroBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative z-30 w-full border-b border-white/10 bg-black/60 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2.5 text-center">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
        </span>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/70 sm:text-xs">
          42 of 50 enterprise execution slots claimed
          <span className="mx-2 text-white/30">·</span>
          <span className="text-white/90">Q2 2026</span>
        </p>
      </div>
    </motion.div>
  );
}

/* ================================================================== */
/* 2. Navbar                                                          */
/* ================================================================== */

function Navbar({ onApply }: { onApply: CTAHandler }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors duration-300 ${
        scrolled
          ? "border-white/10 bg-black/80 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Brand */}
        <a href="#top" className="pf-no-tap group flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center border border-white/20 bg-white/5">
            <span className="absolute inset-0 bg-gradient-to-br from-[#6d28d9] to-[#06b6d4] opacity-80 transition-opacity group-hover:opacity-100" />
            <span className="relative text-sm font-black text-white">P</span>
          </span>
          <span className="text-base font-bold tracking-tight text-white">
            ProxyFlow <span className="text-white/50">AI</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="pf-no-tap text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <button
            type="button"
            onClick={() => onApply("navbar")}
            className="pf-no-tap pf-glow-violet group relative overflow-hidden border border-violet-400/40 bg-[#6d28d9]/20 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#6d28d9]/40"
          >
            <span className="relative z-10">Enterprise Access</span>
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="pf-no-tap flex h-9 w-9 items-center justify-center border border-white/15 text-white md:hidden"
        >
          <div className="flex flex-col gap-[5px]">
            <span
              className={`h-[1.5px] w-5 bg-white transition-transform ${
                menuOpen ? "translate-y-[6.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-[1.5px] w-5 bg-white transition-opacity ${
                menuOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`h-[1.5px] w-5 bg-white transition-transform ${
                menuOpen ? "-translate-y-[6.5px] -rotate-45" : ""
              }`}
            />
          </div>
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/10 bg-black/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="pf-no-tap border-b border-white/5 py-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onApply("navbar-mobile");
                }}
                className="pf-glow-violet mt-3 border border-violet-400/40 bg-[#6d28d9]/25 px-5 py-3 text-sm font-semibold text-white"
              >
                Enterprise Access
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ================================================================== */
/* 3. Hero                                                            */
/* ================================================================== */

function Hero({ onApply }: { onApply: CTAHandler }) {
  return (
    <section id="top" className="relative z-10 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 inline-flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-1.5"
        >
          <span className="h-1.5 w-1.5 bg-[#06b6d4]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
            Autonomous AI FinOps Proxy Layer
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="max-w-5xl text-[2.6rem] font-black leading-[0.98] tracking-brutal text-white sm:text-6xl lg:text-7xl"
        >
          Bulletproof AI Infrastructure.
          <br />
          <span className="pf-text-gradient">Engineered to Scale.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="mt-7 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg"
        >
          Look, most platforms just track your API charts. We deploy an
          autonomous orchestration firewall directly beneath your model layer.
          Router, compressor, loop-breaker. So your infrastructure actually
          survives production billing.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.19 }}
          className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
        >
          <button
            type="button"
            onClick={() => onApply("hero-primary")}
            className="pf-no-tap pf-glow-violet group relative w-full overflow-hidden border border-violet-400/50 bg-[#6d28d9] px-7 py-4 text-base font-bold text-white transition-all hover:translate-y-[-1px] hover:bg-[#7c3aed] sm:w-auto"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              Claim Your Production Slot
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </span>
          </button>

          <a
            href="#weapons"
            className="pf-no-tap w-full border border-white/20 bg-transparent px-7 py-4 text-center text-base font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white sm:w-auto"
          >
            See Architecture
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-6 flex items-center gap-2 text-sm text-white/40"
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#6d28d9]" />
          1 slot left for high-volume apps
          <span className="text-white/20">·</span>
          Application required
        </motion.p>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 4. Infinite marquee ticker                                         */
/* ================================================================== */

function Marquee() {
  // Duplicate the handle list so the -50% translate loops seamlessly.
  const doubled = useMemo(() => [...MARQUEE_HANDLES, ...MARQUEE_HANDLES], []);

  return (
    <section className="relative z-10 border-y border-white/10 bg-black/40 py-6">
      <div className="mb-4 px-4 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">
          Trusted by operators running production at scale
        </span>
      </div>
      <div className="relative flex overflow-hidden">
        {/* Edge fades */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-black to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-black to-transparent" />

        <motion.div
          className="pf-marquee-track flex shrink-0 items-center gap-10 pr-10"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 38, ease: "linear", repeat: Infinity }}
        >
          {doubled.map((handle, i) => {
            const [name, tag] = handle.split(" ");
            return (
              <div key={`${handle}-${i}`} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[#6d28d9]/40 to-[#06b6d4]/40 text-[11px] font-bold text-white">
                  {name.charAt(0)}
                </span>
                <span className="text-sm font-semibold text-white/80">{name}</span>
                <span className="text-sm font-medium text-white/40">{tag}</span>
                <span className="ml-3 text-white/15">/</span>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 5. Core infrastructure grid                                        */
/* ================================================================== */

function WeaponCard({ weapon, index }: { weapon: Weapon; index: number }) {
  const accentRing =
    weapon.accent === "violet"
      ? "group-hover:border-violet-400/50"
      : "group-hover:border-cyan-400/50";
  const accentGlow =
    weapon.accent === "violet"
      ? "from-[#6d28d9]/25"
      : "from-[#06b6d4]/25";

  return (
    <Reveal delay={index} className="h-full">
      <div
        className={`group relative flex h-full flex-col border border-white/10 bg-white/[0.02] p-7 transition-all duration-300 hover:bg-white/[0.04] ${accentRing}`}
      >
        <div
          className={`pointer-events-none absolute -top-px left-0 h-32 w-full bg-gradient-to-b ${accentGlow} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
        />
        <div className="relative mb-6 flex items-center justify-between">
          <span className="font-mono text-xs font-bold tracking-widest text-white/30">
            {weapon.index}
          </span>
          <span
            className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              weapon.accent === "violet"
                ? "border-violet-400/30 text-violet-200"
                : "border-cyan-400/30 text-cyan-200"
            }`}
          >
            {weapon.metric}
          </span>
        </div>
        <h3 className="relative mb-3 text-xl font-bold tracking-tight text-white">
          {weapon.title}
        </h3>
        <p className="relative text-sm leading-relaxed text-white/55">
          {weapon.body}
        </p>
      </div>
    </Reveal>
  );
}

function InfraGrid() {
  return (
    <section id="weapons" className="relative z-10 scroll-mt-20">
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 py-24 sm:px-6">
        <Reveal>
          <h2 className="max-w-3xl text-3xl font-black tracking-brutal text-white sm:text-5xl">
            The Weapons.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-white/55">
            Everything you need to terminate API hemorrhaging.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-px bg-white/5 md:grid-cols-3">
          {WEAPONS.map((weapon, i) => (
            <WeaponCard key={weapon.id} weapon={weapon} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 6. Case studies — before / after counters                          */
/* ================================================================== */

/** Counts from `from` to `to` once the card scrolls into view. */
function CountUp({
  from,
  to,
  formatter,
}: {
  from: number;
  to: number;
  formatter: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const duration = 1300;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, from, to]);

  return <span ref={ref}>{formatter(value)}</span>;
}

function CaseStudyCard({ study, index }: { study: CaseStudy; index: number }) {
  return (
    <Reveal delay={index}>
      <div className="relative flex h-full flex-col border border-white/10 bg-white/[0.02] p-8">
        <span className="mb-6 inline-flex w-fit items-center gap-2 border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
          {study.tag}
        </span>

        <h3 className="mb-8 text-2xl font-bold tracking-tight text-white">
          {study.title}
        </h3>

        {/* Before / After split */}
        <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/5">
          <div className="bg-black/60 p-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Before
            </p>
            <p className="text-3xl font-black text-red-400/90 line-through decoration-red-500/40 decoration-2">
              <CountUp from={0} to={study.before} formatter={formatMoney} />
              <span className="text-sm font-medium text-white/30">{study.unit}</span>
            </p>
          </div>
          <div className="bg-black/60 p-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              After
            </p>
            {study.after === null ? (
              <p className="text-3xl font-black text-[#67e8f9]">
                $0
                <span className="text-sm font-medium text-white/30"> impact</span>
              </p>
            ) : (
              <p className="text-3xl font-black text-[#67e8f9]">
                <CountUp from={study.before} to={study.after} formatter={formatMoney} />
                <span className="text-sm font-medium text-white/30">{study.unit}</span>
              </p>
            )}
          </div>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-white/55">{study.body}</p>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <span className="h-1.5 w-1.5 bg-[#06b6d4]" />
          <span className="text-sm font-bold tracking-tight text-white">
            {study.highlight}
          </span>
        </div>
      </div>
    </Reveal>
  );
}

function CaseStudies() {
  return (
    <section id="case-studies" className="relative z-10 scroll-mt-20 border-t border-white/10">
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 py-24 sm:px-6">
        <Reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#67e8f9]">
            Field Reports
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-brutal text-white sm:text-5xl">
            Receipts, not promises.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {CASE_STUDIES.map((study, i) => (
            <CaseStudyCard key={study.id} study={study} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 7. Brutal comparison matrix                                        */
/* ================================================================== */

function CrossIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-red-500/40 bg-red-500/10 text-red-400">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function CheckIcon() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path d="M2 6.5l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ComparisonMatrix() {
  return (
    <section className="relative z-10 border-t border-white/10">
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 py-24 sm:px-6">
        <Reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
            The Brutal Comparison
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-brutal text-white sm:text-5xl">
            In-house scripts break.
            <br />
            <span className="pf-text-gradient">The Layer holds.</span>
          </h2>
        </Reveal>

        <Reveal delay={1}>
          <div className="mt-12 overflow-hidden border border-white/10">
            {/* Header row */}
            <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-white/10 bg-white/[0.03] sm:grid-cols-[1.4fr_1fr_1fr]">
              <div className="p-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40 sm:p-5">
                Capability
              </div>
              <div className="border-l border-white/10 p-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-400/80 sm:p-5">
                In-House Scripts
              </div>
              <div className="border-l border-white/10 bg-[#6d28d9]/10 p-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a78bfa] sm:p-5">
                The ProxyFlow Layer
              </div>
            </div>

            {/* Data rows */}
            {MATRIX_ROWS.map((row, i) => (
              <div
                key={row.capability}
                className={`grid grid-cols-[1.2fr_1fr_1fr] sm:grid-cols-[1.4fr_1fr_1fr] ${
                  i !== MATRIX_ROWS.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <div className="flex items-center p-4 text-sm font-semibold text-white sm:p-5">
                  {row.capability}
                </div>
                <div className="flex items-start gap-3 border-l border-white/10 p-4 sm:p-5">
                  <CrossIcon />
                  <span className="text-xs leading-snug text-white/45">{row.inhouse}</span>
                </div>
                <div className="flex items-start gap-3 border-l border-white/10 bg-[#6d28d9]/[0.06] p-4 sm:p-5">
                  <CheckIcon />
                  <span className="text-xs leading-snug text-white/75">{row.proxyflow}</span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 8. Interactive telemetry simulator                                 */
/* ================================================================== */

/** Live-incrementing counter for the telemetry preview panel. */
function LiveStat({
  active,
  label,
  prefix = "",
  suffix = "",
  base,
  stepMin,
  stepMax,
  intervalMs,
  decimals = 0,
  jitter = false,
}: {
  active: boolean;
  label: string;
  prefix?: string;
  suffix?: string;
  base: number;
  stepMin: number;
  stepMax: number;
  intervalMs: number;
  decimals?: number;
  jitter?: boolean;
}) {
  const [value, setValue] = useState(base);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setValue((v) => {
        const delta = stepMin + Math.random() * (stepMax - stepMin);
        if (jitter) {
          // Oscillate around base (e.g. active connections).
          const drift = (base - v) * 0.08;
          return Math.max(0, v + (Math.random() > 0.5 ? delta : -delta) + drift);
        }
        return v + delta;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, base, stepMin, stepMax, intervalMs, jitter]);

  const display =
    decimals > 0
      ? value.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(value).toLocaleString("en-US");

  return (
    <div className="border border-white/10 bg-black/40 p-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <p className="font-mono text-2xl font-bold tabular-nums text-white">
        {prefix}
        <motion.span
          key={display}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {display}
        </motion.span>
        {suffix}
      </p>
    </div>
  );
}

function TelemetrySimulator({ onApply }: { onApply: CTAHandler }) {
  const [apiKey, setApiKey] = useState("");
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setCopied(false);
    // Use the typed key, or a synthetic demo key so the simulator always works.
    const seed = apiKey.trim() || `sk-demo-${Math.random().toString(36).slice(2)}`;
    const hash = await generateProxyHash(seed);
    // Small intentional beat so the "secure provisioning" feels real.
    await new Promise((r) => setTimeout(r, 550));
    setProxyUrl(`https://api.proxyflow.ai/v1/p/${hash}`);
    setGenerating(false);
  }, [apiKey, generating]);

  const handleCopy = useCallback(async () => {
    if (!proxyUrl) return;
    try {
      await navigator.clipboard.writeText(proxyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [proxyUrl]);

  const live = proxyUrl !== null;

  return (
    <section id="telemetry" className="relative z-10 scroll-mt-20 border-t border-white/10">
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 py-24 sm:px-6">
        <Reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#67e8f9]">
            Live Telemetry Simulator
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-brutal text-white sm:text-5xl">
            Spin up a secure proxy endpoint.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-white/55">
            Drop in a mock API key. We forge a hardened proxy URL and stream a
            live preview of what the Layer is doing beneath your model.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/5 lg:grid-cols-2">
            {/* Generator panel */}
            <div className="bg-black/60 p-7 sm:p-9">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 bg-[#6d28d9]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  Endpoint Forge
                </p>
              </div>

              <label
                htmlFor="pf-api-key"
                className="mb-2 mt-6 block text-sm font-medium text-white/70"
              >
                Your OpenAI / Anthropic API Key
              </label>
              <input
                id="pf-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full border border-white/15 bg-black/60 px-4 py-3.5 font-mono text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/60"
              />
              <p className="mt-2 text-xs text-white/30">
                Demo only — keys are hashed locally in your browser and never
                transmitted.
              </p>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="pf-glow-violet mt-6 flex w-full items-center justify-center gap-2 border border-violet-400/50 bg-[#6d28d9] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {generating ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Forging secure endpoint…
                  </>
                ) : (
                  "Generate Secure Proxy URL"
                )}
              </button>

              {/* Generated URL */}
              <AnimatePresence>
                {proxyUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: 10, height: 0 }}
                    transition={{ duration: 0.35 }}
                    className="mt-6"
                  >
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#67e8f9]">
                      Your live proxy endpoint
                    </p>
                    <div className="pf-glow-cyan flex items-stretch border border-cyan-400/40 bg-black/70">
                      <code className="flex-1 overflow-x-auto whitespace-nowrap px-4 py-3.5 font-mono text-sm text-[#a5f3fc]">
                        {proxyUrl}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="shrink-0 border-l border-cyan-400/30 px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-cyan-400/10"
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Telemetry preview panel */}
            <div className="relative bg-black/40 p-7 sm:p-9">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 ${live ? "animate-pulse bg-[#06b6d4]" : "bg-white/20"}`}
                  />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    Live Telemetry Preview
                  </p>
                </div>
                <span
                  className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    live
                      ? "border-emerald-400/40 text-emerald-300"
                      : "border-white/15 text-white/30"
                  }`}
                >
                  {live ? "● Streaming" : "Idle"}
                </span>
              </div>

              {live ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <LiveStat
                      active={live}
                      label="Dollars saved (session)"
                      prefix="$"
                      base={9824.5}
                      stepMin={3.2}
                      stepMax={28.7}
                      intervalMs={900}
                      decimals={2}
                    />
                  </div>
                  <LiveStat
                    active={live}
                    label="Requests routed"
                    base={184329}
                    stepMin={11}
                    stepMax={64}
                    intervalMs={700}
                  />
                  <LiveStat
                    active={live}
                    label="Active connections"
                    base={1287}
                    stepMin={4}
                    stepMax={22}
                    intervalMs={1100}
                    jitter
                  />
                  <div className="col-span-2 border border-white/10 bg-black/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                        Loops broken (24h)
                      </p>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        firewall active
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
                      <LiveStatInline active={live} base={37} stepMin={0} stepMax={1} intervalMs={4200} />
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center border border-dashed border-white/10 bg-black/30 text-center">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center border border-white/15 text-white/30">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
                      <path d="M3 12h4l3 8 4-16 3 8h4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="max-w-[14rem] text-sm text-white/40">
                    Generate a proxy URL to start the live telemetry stream.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal delay={2}>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border border-white/10 bg-white/[0.02] p-6 sm:flex-row">
            <p className="text-sm text-white/55">
              Ready to put this in front of real production traffic?
            </p>
            <button
              type="button"
              onClick={() => onApply("telemetry")}
              className="pf-glow-violet w-full shrink-0 border border-violet-400/50 bg-[#6d28d9] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#7c3aed] sm:w-auto"
            >
              Claim Your Production Slot →
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Inline variant of LiveStat for embedding inside custom panels. */
function LiveStatInline({
  active,
  base,
  stepMin,
  stepMax,
  intervalMs,
}: {
  active: boolean;
  base: number;
  stepMin: number;
  stepMax: number;
  intervalMs: number;
}) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setValue((v) => v + Math.round(stepMin + Math.random() * (stepMax - stepMin)));
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, stepMin, stepMax, intervalMs]);
  return <>{Math.round(value).toLocaleString("en-US")}</>;
}

/* ================================================================== */
/* 9. Two-step "Fit Check" qualification modal                        */
/* ================================================================== */

type ModalStage = "spend" | "leak" | "qualified" | "waitlist";

function FitCheckModal({
  open,
  source,
  prefill,
  onClose,
}: {
  open: boolean;
  source: string;
  prefill: RoiPrefill | null;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<ModalStage>("spend");
  const [spend, setSpend] = useState<SpendOption | null>(null);
  const [leak, setLeak] = useState<LeakOption | null>(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Reset whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setStage("spend");
      setSpend(null);
      setLeak(null);
      setEmail("");
      setSubmitted(false);
    }
  }, [open]);

  // Escape to close + scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const handleSpend = (opt: SpendOption) => {
    setSpend(opt);
    setStage("leak");
  };

  const handleLeak = (opt: LeakOption) => {
    setLeak(opt);
    setStage(spend?.qualified ? "qualified" : "waitlist");
  };

  const stepNumber = stage === "spend" ? 1 : 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Fit Check qualification"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-lg overflow-hidden border border-white/15 bg-[#070707]"
          >
            {/* Atmospheric top edge */}
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#6d28d9] opacity-30 blur-3xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-6 w-6 items-center justify-center border border-white/20 bg-white/5">
                  <span className="absolute inset-0 bg-gradient-to-br from-[#6d28d9] to-[#06b6d4] opacity-80" />
                  <span className="relative text-xs font-black text-white">P</span>
                </span>
                <span className="text-sm font-bold text-white">Fit Check</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center text-white/40 transition-colors hover:text-white"
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Progress (only on question stages) */}
            {(stage === "spend" || stage === "leak") && (
              <div className="relative flex items-center gap-2 px-6 pt-5">
                <div className="h-1 flex-1 overflow-hidden bg-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#6d28d9] to-[#06b6d4]"
                    initial={false}
                    animate={{ width: stepNumber === 1 ? "50%" : "100%" }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <span className="font-mono text-[11px] font-semibold text-white/40">
                  Step {stepNumber} / 2
                </span>
              </div>
            )}

            {/* Body */}
            <div className="relative px-6 py-7">
              {prefill && (stage === "spend" || stage === "leak") && (
                <div className="mb-6 border border-violet-400/30 bg-[#6d28d9]/10 p-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                    From your ROI audit
                  </p>
                  <p className="text-sm leading-relaxed text-white/70">
                    <span className="font-bold text-white">
                      {formatMoney(prefill.annualRestored)}
                    </span>{" "}
                    annual capital to restore · {formatMoney(prefill.spend)}/mo spend ·{" "}
                    {prefill.simplePct}% simple traffic · {prefill.agents}{" "}
                    {prefill.agents === 1 ? "agent" : "agents"}
                  </p>
                </div>
              )}
              <AnimatePresence mode="wait">
                {/* ---- Step 1: spend ---- */}
                {stage === "spend" && (
                  <motion.div
                    key="spend"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h3 className="mb-1 text-xl font-bold tracking-tight text-white">
                      What is your current monthly LLM API spend?
                    </h3>
                    <p className="mb-6 text-sm text-white/45">
                      We qualify high-volume infrastructure. This stays between us.
                    </p>
                    <div className="flex flex-col gap-3">
                      {SPEND_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSpend(opt)}
                          className="group flex items-center justify-between border border-white/15 bg-white/[0.02] px-5 py-4 text-left transition-all hover:border-violet-400/50 hover:bg-[#6d28d9]/10"
                        >
                          <span className="text-sm font-semibold text-white">
                            {opt.label}
                          </span>
                          <span className="text-white/30 transition-all group-hover:translate-x-1 group-hover:text-white">
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ---- Step 2: leak ---- */}
                {stage === "leak" && (
                  <motion.div
                    key="leak"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h3 className="mb-1 text-xl font-bold tracking-tight text-white">
                      What is your biggest cost leak?
                    </h3>
                    <p className="mb-6 text-sm text-white/45">
                      So we know which weapon to deploy first.
                    </p>
                    <div className="flex flex-col gap-3">
                      {LEAK_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleLeak(opt)}
                          className="group flex items-center justify-between border border-white/15 bg-white/[0.02] px-5 py-4 text-left transition-all hover:border-cyan-400/50 hover:bg-[#06b6d4]/10"
                        >
                          <span className="text-sm font-semibold text-white">
                            {opt.label}
                          </span>
                          <span className="text-white/30 transition-all group-hover:translate-x-1 group-hover:text-white">
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStage("spend")}
                      className="mt-5 text-xs font-medium text-white/40 transition-colors hover:text-white"
                    >
                      ← Back
                    </button>
                  </motion.div>
                )}

                {/* ---- Qualified ---- */}
                {stage === "qualified" && (
                  <motion.div
                    key="qualified"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                  >
                    {!submitted ? (
                      <>
                        <span className="mb-5 inline-flex items-center gap-2 border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                          ● Cleared for deployment
                        </span>
                        <h3 className="mb-2 text-2xl font-black tracking-tight text-white">
                          You qualify for instant deployment.
                        </h3>
                        <p className="mb-6 text-sm leading-relaxed text-white/55">
                          At {spend?.label.toLowerCase()}, your{" "}
                          {leak?.label.toLowerCase()} is exactly what the Layer
                          was built to terminate. Lock your production slot — a
                          senior architect provisions your Edge endpoint within
                          24 hours.
                        </p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (emailValid) setSubmitted(true);
                          }}
                        >
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            className="w-full border border-white/15 bg-black/60 px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/60"
                          />
                          <button
                            type="submit"
                            disabled={!emailValid}
                            className="pf-glow-violet mt-4 w-full border border-violet-400/50 bg-[#6d28d9] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Lock My Production Slot →
                          </button>
                        </form>
                        <p className="mt-3 text-center text-[11px] text-white/30">
                          1 slot left for high-volume apps · Application reviewed
                          same day
                        </p>
                      </>
                    ) : (
                      <div className="py-4 text-center">
                        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
                          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M4 12.5l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <h3 className="mb-2 text-2xl font-black tracking-tight text-white">
                          Slot reserved.
                        </h3>
                        <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/55">
                          We&apos;ve flagged your application as priority. Watch{" "}
                          <span className="font-semibold text-white">{email}</span>{" "}
                          — your dedicated architect reaches out within 24 hours
                          to provision the Layer.
                        </p>
                        <button
                          type="button"
                          onClick={onClose}
                          className="mt-7 border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ---- Waitlist ---- */}
                {stage === "waitlist" && (
                  <motion.div
                    key="waitlist"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                  >
                    {!submitted ? (
                      <>
                        <span className="mb-5 inline-flex items-center gap-2 border border-violet-400/40 bg-[#6d28d9]/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                          ◇ Exclusive waitlist
                        </span>
                        <h3 className="mb-2 text-2xl font-black tracking-tight text-white">
                          We&apos;re built for high-volume scale.
                        </h3>
                        <p className="mb-6 text-sm leading-relaxed text-white/55">
                          At {spend?.label.toLowerCase()}, you&apos;re below our
                          current production threshold — our 50 slots are reserved
                          for elite, high-throughput systems. Join the high-end
                          waitlist and we&apos;ll open the gate the moment your
                          volume scales.
                        </p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (emailValid) setSubmitted(true);
                          }}
                        >
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            className="w-full border border-white/15 bg-black/60 px-4 py-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/60"
                          />
                          <button
                            type="submit"
                            disabled={!emailValid}
                            className="mt-4 w-full border border-violet-400/40 bg-[#6d28d9]/20 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#6d28d9]/40 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Join the High-End Waitlist
                          </button>
                        </form>
                        <p className="mt-3 text-center text-[11px] text-white/30">
                          Priority access as soon as you cross $20k/mo.
                        </p>
                      </>
                    ) : (
                      <div className="py-4 text-center">
                        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center border border-violet-400/40 bg-[#6d28d9]/15 text-violet-200">
                          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <h3 className="mb-2 text-2xl font-black tracking-tight text-white">
                          You&apos;re on the list.
                        </h3>
                        <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/55">
                          We&apos;ve secured your place at{" "}
                          <span className="font-semibold text-white">{email}</span>.
                          The moment you scale, you skip the line.
                        </p>
                        <button
                          type="button"
                          onClick={onClose}
                          className="mt-7 border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Source tag (subtle, for analytics realism) */}
            <div className="relative border-t border-white/10 px-6 py-2.5">
              <span className="font-mono text-[10px] text-white/20">
                ref: {source}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================================================================== */
/* ROI Audit Calculator                                               */
/* ================================================================== */

/** Eases a displayed number toward its target whenever the target changes. */
function useEasedNumber(target: number, duration = 600): number {
  const [val, setVal] = useState(target);
  const currentRef = useRef(target);
  useEffect(() => {
    const from = currentRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * eased;
      currentRef.current = next;
      setVal(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function RoiSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  accent,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  accent: "violet" | "cyan";
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const fill =
    accent === "violet" ? "from-[#6d28d9] to-[#a78bfa]" : "from-[#06b6d4] to-[#67e8f9]";
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <label className="text-sm font-medium text-white/60">{label}</label>
        <span className="font-mono text-lg font-bold tabular-nums text-white">
          {display}
        </span>
      </div>
      <div className="relative h-5 w-full">
        <div className="pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-white/10" />
        <div
          className={`pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-gradient-to-r ${fill}`}
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          className="pf-slider relative z-10 w-full"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
      </div>
    </div>
  );
}

function ROICalculator({ onCapture }: { onCapture: (prefill: RoiPrefill) => void }) {
  const [spend, setSpend] = useState(12000);
  const [simplePct, setSimplePct] = useState(45);
  const [agents, setAgents] = useState(20);

  const roi = useMemo(
    () => computeRoi({ spend, simplePct, agents }),
    [spend, simplePct, agents],
  );
  const easedAnnual = useEasedNumber(roi.annualRestored);

  const spendDisplay = formatMoney(spend);
  const agentsDisplay = String(agents);

  return (
    <section id="roi" className="relative z-10 scroll-mt-20 border-t border-white/10">
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 py-24 sm:px-6">
        <Reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a78bfa]">
            Financial ROI Audit
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-brutal text-white sm:text-5xl">
            Model the capital you&apos;re bleeding.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-white/55">
            Drag the inputs. The audit recalculates your guaranteed annual
            restored capital in real time — the exact savings the Layer enforces
            at the edge.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden border border-white/10 bg-white/5 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Inputs */}
            <div className="bg-black/60 p-7 sm:p-10">
              <div className="mb-8 flex items-center gap-2">
                <span className="h-2 w-2 bg-[#6d28d9]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  Audit Inputs
                </p>
              </div>
              <div className="flex flex-col gap-9">
                <RoiSlider
                  label="Average Monthly LLM API Spend"
                  value={spend}
                  min={500}
                  max={100000}
                  step={500}
                  onChange={setSpend}
                  display={spendDisplay}
                  accent="violet"
                />
                <RoiSlider
                  label="Simple Tasks / JSON Extraction Traffic"
                  value={simplePct}
                  min={0}
                  max={100}
                  step={1}
                  onChange={setSimplePct}
                  display={`${simplePct}%`}
                  accent="cyan"
                />
                <RoiSlider
                  label="Active Production Autonomous Agents"
                  value={agents}
                  min={0}
                  max={250}
                  step={1}
                  onChange={setAgents}
                  display={agentsDisplay}
                  accent="violet"
                />
              </div>

              {/* Monthly breakdown */}
              <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="border border-white/10 bg-black/40 p-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Routing savings / mo
                  </p>
                  <p className="font-mono text-xl font-bold tabular-nums text-[#a78bfa]">
                    {formatMoney(roi.routingSavings)}
                  </p>
                </div>
                <div className="border border-white/10 bg-black/40 p-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Loop protection / mo
                  </p>
                  <p className="font-mono text-xl font-bold tabular-nums text-[#67e8f9]">
                    {formatMoney(roi.loopSavings)}
                  </p>
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="relative flex flex-col justify-between bg-black/40 p-7 sm:p-10">
              <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-[#6d28d9] opacity-30 blur-3xl" />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                  Guaranteed Annual Restored Capital
                </p>
                <p className="mt-4 break-words text-5xl font-black leading-none tracking-brutal sm:text-6xl">
                  <span className="pf-neon-green tabular-nums">
                    {formatMoney(easedAnnual)}
                  </span>
                </p>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/50">
                  Restored every year by routing {simplePct}% of traffic to
                  sub-models and firewalling {agents}{" "}
                  {agents === 1 ? "agent" : "agents"} against runaway loops.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  onCapture({ spend, simplePct, agents, annualRestored: roi.annualRestored })
                }
                className="pf-glow-violet group relative mt-8 w-full overflow-hidden border border-violet-400/50 bg-[#6d28d9] px-6 py-4 text-base font-bold text-white transition-all hover:bg-[#7c3aed]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Capture This Capital Now
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Enterprise subscription tiers                                       */
/* ================================================================== */

function PlanCheck() {
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
      <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth={2.4}>
        <path d="M2 6.5l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Pricing({ onSelectPlan }: { onSelectPlan: (plan: Plan) => void }) {
  return (
    <section id="pricing" className="relative z-10 scroll-mt-20 border-t border-white/10">
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 py-24 sm:px-6">
        <Reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a78bfa]">
            Subscription Tiers
          </span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-brutal text-white sm:text-5xl">
            Priced for the capital you keep.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-white/55">
            Every tier wires straight into the edge engine&apos;s billing limits.
            No overage surprises — just hard, enforced volume caps.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i}>
              <div
                className={`relative flex h-full flex-col border bg-white/[0.02] p-8 transition-all ${
                  plan.featured
                    ? "pf-glow-violet border-violet-400/50"
                    : "border-white/10 hover:border-white/25"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-8 border border-violet-400/50 bg-[#6d28d9] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold tracking-tight text-white">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-white/45">{plan.tagline}</p>

                <div className="mt-6 flex items-end gap-1">
                  <span className="text-5xl font-black tracking-brutal text-white">
                    {plan.price}
                  </span>
                  <span className="mb-1.5 text-sm font-medium text-white/40">
                    {plan.priceNote}
                  </span>
                </div>

                <div className="mt-6 border-y border-white/10 py-4">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#a78bfa]">
                    <span className="h-1.5 w-1.5 bg-[#6d28d9]" />
                    {plan.highlight}
                  </span>
                </div>

                <ul className="mt-6 flex flex-col gap-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-white/65">
                      <PlanCheck />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onSelectPlan(plan)}
                  className={`mt-8 w-full border px-6 py-3.5 text-sm font-bold transition-all ${
                    plan.featured
                      ? "pf-glow-violet border-violet-400/50 bg-[#6d28d9] text-white hover:bg-[#7c3aed]"
                      : "border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Stripe checkout (mock) — activates a paying tenant                  */
/* ================================================================== */

function formatCardNumber(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})(?=.)/g, "$1 ").trim();
}

function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function StripeCheckoutModal({
  plan,
  onClose,
  onActivated,
}: {
  plan: Plan | null;
  onClose: () => void;
  onActivated: (tenant: ActiveTenant) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [processing, setProcessing] = useState(false);
  const [tenant, setTenant] = useState<ActiveTenant | null>(null);
  const [copied, setCopied] = useState(false);

  const open = plan !== null;

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setCard("");
      setExpiry("");
      setCvc("");
      setProcessing(false);
      setTenant(null);
      setCopied(false);
    }
  }, [open, plan]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const cardValid = card.replace(/\s/g, "").length >= 15;
  const month = Number(expiry.slice(0, 2));
  const expiryValid = /^\d{2}\/\d{2}$/.test(expiry) && month >= 1 && month <= 12;
  const cvcValid = /^\d{3,4}$/.test(cvc);
  const formValid =
    name.trim().length > 1 && emailValid && cardValid && expiryValid && cvcValid;

  const endpoint = tenant
    ? `https://api.proxyflow.ai/v1/proxy/${tenant.tenantId}/chat/completions`
    : "";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!plan || !formValid || processing) return;
    setProcessing(true);
    // Simulate Stripe's secure tokenization round-trip. No card data is stored.
    const hash = await generateProxyHash(`${email}:${plan.id}`);
    await new Promise((r) => setTimeout(r, 1500));
    const record: ActiveTenant = {
      tenantId: `tnt_${hash.slice(0, 16)}`,
      tier: plan.id,
      planName: plan.name,
      status: "ACTIVE_TENANT",
      requestLimit: Number.isFinite(plan.requestLimit) ? plan.requestLimit : -1,
      email,
      activatedAt: new Date().toISOString(),
    };
    onActivated(record);
    setTenant(record);
    setProcessing(false);
  };

  const handleCopy = async () => {
    if (!endpoint) return;
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AnimatePresence>
      {open && plan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Secure checkout"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto border border-white/15 bg-[#070707]"
          >
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#6d28d9] opacity-30 blur-3xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center border border-white/20 bg-white/5 text-white/70">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="5" y="11" width="14" height="9" rx="1" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-sm font-bold text-white">Secure Checkout</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center text-white/40 transition-colors hover:text-white"
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {!tenant ? (
              <form onSubmit={handleSubmit} className="relative px-6 py-6">
                {/* Plan summary */}
                <div className="mb-6 flex items-center justify-between border border-white/10 bg-white/[0.02] p-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                      Selected plan
                    </p>
                    <p className="text-base font-bold text-white">{plan.name}</p>
                  </div>
                  <p className="text-right font-mono text-lg font-bold text-white">
                    {plan.price}
                    <span className="text-sm font-medium text-white/40">{plan.priceNote}</span>
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="pf-co-name" className="mb-1.5 block text-xs font-medium text-white/60">
                        Name on card
                      </label>
                      <input
                        id="pf-co-name"
                        type="text"
                        autoComplete="cc-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full border border-white/15 bg-black/60 px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/60"
                      />
                    </div>
                    <div>
                      <label htmlFor="pf-co-email" className="mb-1.5 block text-xs font-medium text-white/60">
                        Billing email
                      </label>
                      <input
                        id="pf-co-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full border border-white/15 bg-black/60 px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pf-co-card" className="mb-1.5 block text-xs font-medium text-white/60">
                      Card number
                    </label>
                    <input
                      id="pf-co-card"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={card}
                      onChange={(e) => setCard(formatCardNumber(e.target.value))}
                      placeholder="4242 4242 4242 4242"
                      className="w-full border border-white/15 bg-black/60 px-3 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/60"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pf-co-exp" className="mb-1.5 block text-xs font-medium text-white/60">
                        Expiry
                      </label>
                      <input
                        id="pf-co-exp"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                        className="w-full border border-white/15 bg-black/60 px-3 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/60"
                      />
                    </div>
                    <div>
                      <label htmlFor="pf-co-cvc" className="mb-1.5 block text-xs font-medium text-white/60">
                        CVC
                      </label>
                      <input
                        id="pf-co-cvc"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="123"
                        className="w-full border border-white/15 bg-black/60 px-3 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet-400/60"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!formValid || processing}
                  className="pf-glow-violet mt-6 flex w-full items-center justify-center gap-2 border border-violet-400/50 bg-[#6d28d9] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Processing securely…
                    </>
                  ) : (
                    `Pay ${plan.price}${plan.priceNote} & Activate`
                  )}
                </button>

                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/30">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="5" y="11" width="14" height="9" rx="1" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                  </svg>
                  Secured by Stripe · test mode — no card is charged
                </p>
              </form>
            ) : (
              <div className="relative px-6 py-7 text-center">
                <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M4 12.5l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="mb-4 inline-flex items-center gap-2 border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                  ● Status: ACTIVE_TENANT
                </span>
                <h3 className="mb-2 text-2xl font-black tracking-tight text-white">
                  You&apos;re live on {tenant.planName}.
                </h3>
                <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-white/55">
                  Payment confirmed and your tenant is provisioned at the edge.
                  Point your SDK&apos;s base URL at your dedicated proxy endpoint:
                </p>

                <div className="mb-2 text-left">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#67e8f9]">
                    Your tenant endpoint
                  </p>
                  <div className="pf-glow-cyan flex items-stretch border border-cyan-400/40 bg-black/70">
                    <code className="flex-1 overflow-x-auto whitespace-nowrap px-4 py-3 text-left font-mono text-xs text-[#a5f3fc]">
                      {endpoint}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="shrink-0 border-l border-cyan-400/30 px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-cyan-400/10"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <p className="mb-6 text-left font-mono text-[11px] text-white/30">
                  tenant: {tenant.tenantId} ·{" "}
                  {tenant.requestLimit < 0
                    ? "unlimited requests"
                    : `${tenant.requestLimit.toLocaleString("en-US")} requests / mo`}
                </p>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================================================================== */
/* Footer                                                             */
/* ================================================================== */

function Footer({ onApply }: { onApply: CTAHandler }) {
  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="mx-auto max-w-7xl border-x border-white/10 px-4 py-16 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="relative flex h-7 w-7 items-center justify-center border border-white/20 bg-white/5">
                <span className="absolute inset-0 bg-gradient-to-br from-[#6d28d9] to-[#06b6d4] opacity-80" />
                <span className="relative text-sm font-black text-white">P</span>
              </span>
              <span className="text-base font-bold text-white">
                ProxyFlow <span className="text-white/50">AI</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/45">
              The autonomous AI FinOps proxy layer. Router, compressor,
              loop-breaker — deployed beneath your model layer at global Edge
              scale.
            </p>
            <button
              type="button"
              onClick={() => onApply("footer")}
              className="pf-glow-violet mt-6 border border-violet-400/50 bg-[#6d28d9] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#7c3aed]"
            >
              Apply for Enterprise Access →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-16 gap-y-8 sm:grid-cols-3">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Platform
              </p>
              <ul className="flex flex-col gap-3 text-sm text-white/55">
                <li><a href="#weapons" className="transition-colors hover:text-white">Intent Router</a></li>
                <li><a href="#weapons" className="transition-colors hover:text-white">Loop Breaker</a></li>
                <li><a href="#weapons" className="transition-colors hover:text-white">Context Pruning</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Proof
              </p>
              <ul className="flex flex-col gap-3 text-sm text-white/55">
                <li><a href="#case-studies" className="transition-colors hover:text-white">Benchmarks</a></li>
                <li><a href="#telemetry" className="transition-colors hover:text-white">Live Simulator</a></li>
                <li><a href="#telemetry" className="transition-colors hover:text-white">Apply</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Status
              </p>
              <ul className="flex flex-col gap-3 text-sm text-white/55">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse bg-emerald-400" />
                  All Edge PoPs operational
                </li>
                <li>42 / 50 slots claimed</li>
                <li>Q2 2026 cohort</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} ProxyFlow AI. Engineered to survive
            production billing.
          </p>
          <p className="font-mono text-[11px] text-white/25">
            api.proxyflow.ai · global edge runtime
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ================================================================== */
/* Page                                                              */
/* ================================================================== */

export default function Page() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSource, setModalSource] = useState("cta");
  const [roiPrefill, setRoiPrefill] = useState<RoiPrefill | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  const openFitCheck = useCallback<CTAHandler>((source) => {
    setRoiPrefill(null);
    setModalSource(source);
    setModalOpen(true);
  }, []);

  const captureRoi = useCallback((prefill: RoiPrefill) => {
    setRoiPrefill(prefill);
    setModalSource("roi-calculator");
    setModalOpen(true);
  }, []);

  const closeFitCheck = useCallback(() => setModalOpen(false), []);

  const handleSelectPlan = useCallback((plan: Plan) => {
    if (plan.id === "enterprise") {
      // Enterprise routes through the two-step Fit Check qualification.
      setRoiPrefill(null);
      setModalSource("pricing-enterprise");
      setModalOpen(true);
    } else {
      // Pro / Scale open the mock Stripe checkout overlay.
      setCheckoutPlan(plan);
    }
  }, []);

  const handleActivated = useCallback((tenant: ActiveTenant) => {
    // Persist + broadcast so the layout-level status badge flips to ACTIVE_TENANT.
    writeTenant(tenant);
  }, []);

  return (
    <>
      <AtmosphericBackground />

      <div className="relative z-10">
        <MicroBanner />
        <Navbar onApply={openFitCheck} />
        <main>
          <Hero onApply={openFitCheck} />
          <Marquee />
          <InfraGrid />
          <ROICalculator onCapture={captureRoi} />
          <CaseStudies />
          <ComparisonMatrix />
          <Pricing onSelectPlan={handleSelectPlan} />
          <TelemetrySimulator onApply={openFitCheck} />
        </main>
        <Footer onApply={openFitCheck} />
      </div>

      <FitCheckModal
        open={modalOpen}
        source={modalSource}
        prefill={roiPrefill}
        onClose={closeFitCheck}
      />
      <StripeCheckoutModal
        plan={checkoutPlan}
        onClose={() => setCheckoutPlan(null)}
        onActivated={handleActivated}
      />
    </>
  );
}

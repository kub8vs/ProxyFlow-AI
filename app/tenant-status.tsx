"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearTenant,
  readTenant,
  TENANT_EVENT,
  type ActiveTenant,
} from "./lib/tenant";

/**
 * Global tenant status indicator, rendered in the root layout. Reflects the
 * ACTIVE_TENANT state set by the pricing checkout flow across the whole app.
 */
export default function TenantStatusBadge() {
  const [tenant, setTenant] = useState<ActiveTenant | null>(null);

  useEffect(() => {
    const sync = () => setTenant(readTenant());
    sync();
    window.addEventListener(TENANT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TENANT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const onSignOut = useCallback(() => clearTenant(), []);

  if (!tenant) return null;

  const tierLabel =
    tenant.tier.charAt(0).toUpperCase() + tenant.tier.slice(1);

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-[calc(100vw-2rem)]">
      <div className="pf-glow-violet flex items-center gap-3 border border-emerald-400/40 bg-black/90 px-4 py-2.5 backdrop-blur-xl">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
            Active Tenant · {tierLabel}
          </p>
          <p className="truncate font-mono text-[11px] text-white/50">
            {tenant.tenantId}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out tenant"
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center border border-white/15 text-white/40 transition-colors hover:text-white"
        >
          <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

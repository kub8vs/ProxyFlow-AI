"use client";

/**
 * Shared multi-tenant client state.
 *
 * The pricing checkout flow activates a paying tenant; that status is persisted
 * to localStorage and broadcast so the layout-level status badge (and any other
 * surface) reflects ACTIVE_TENANT instantly, surviving reloads. The tenantId
 * minted here maps 1:1 to the edge proxy route `/v1/proxy/:tenantId/...`.
 */

export const TENANT_STORAGE_KEY = "proxyflow_tenant";
export const TENANT_EVENT = "proxyflow:tenant";

export type PlanTier = "pro" | "scale" | "enterprise";

export interface ActiveTenant {
  tenantId: string;
  tier: PlanTier;
  planName: string;
  status: "ACTIVE_TENANT";
  /** Monthly optimized-request allowance. -1 denotes unlimited (Enterprise). */
  requestLimit: number;
  email: string;
  activatedAt: string;
}

function isActiveTenant(value: unknown): value is ActiveTenant {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.tenantId === "string" &&
    (t.tier === "pro" || t.tier === "scale" || t.tier === "enterprise") &&
    t.status === "ACTIVE_TENANT" &&
    typeof t.requestLimit === "number"
  );
}

export function readTenant(): ActiveTenant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TENANT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isActiveTenant(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeTenant(tenant: ActiveTenant): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenant));
    window.dispatchEvent(new Event(TENANT_EVENT));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function clearTenant(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TENANT_STORAGE_KEY);
    window.dispatchEvent(new Event(TENANT_EVENT));
  } catch {
    /* ignore */
  }
}

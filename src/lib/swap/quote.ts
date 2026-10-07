import type { OrderResponse } from "@/lib/jupiter/schemas";

export type RouteHop = { label: string; percent: number };

/** Flatten routePlan into labelled hops, e.g. [{label: "Meteora DLMM", percent: 100}]. */
export function summarizeRoute(order: Pick<OrderResponse, "routePlan">): RouteHop[] {
  return (order.routePlan ?? []).map((step) => ({
    label: step.swapInfo.label || "Unknown venue",
    percent: step.percent ?? (step.bps != null ? step.bps / 100 : 100),
  }));
}

export type ImpactSeverity = "low" | "medium" | "high";

/** `priceImpact` is in percentage points and usually ≤ 0 (a cost). */
export function describePriceImpact(priceImpact: number | null | undefined): {
  text: string;
  severity: ImpactSeverity;
} {
  const pct = Math.abs(priceImpact ?? 0);
  const severity: ImpactSeverity = pct >= 5 ? "high" : pct >= 1 ? "medium" : "low";
  const text = pct < 0.01 ? "<0.01%" : `${pct.toFixed(2)}%`;
  return { text, severity };
}

/**
 * True when the signed transaction can no longer land: RFQ quotes carry an
 * `expireAt` timestamp; aggregator quotes a `lastValidBlockHeight`.
 */
export function isOrderExpired(
  order: Pick<OrderResponse, "expireAt" | "lastValidBlockHeight">,
  { now, blockHeight }: { now: number; blockHeight?: number },
): boolean {
  if (order.expireAt) {
    const expireAt = parseExpireAt(order.expireAt);
    if (expireAt !== null && now >= expireAt) return true;
  }
  if (order.lastValidBlockHeight && blockHeight !== undefined) {
    if (blockHeight > Number(order.lastValidBlockHeight)) return true;
  }
  return false;
}

/** `expireAt` may be ISO-8601, unix seconds or unix milliseconds. */
function parseExpireAt(value: string): number | null {
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return n < 1e12 ? n * 1000 : n;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

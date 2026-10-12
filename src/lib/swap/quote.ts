import type { OrderResponse } from "@/lib/jupiter/schemas";

/**
 * `priceImpact` is in percentage points and usually ≤ 0 (a cost). When Jupiter
 * doesn't report it, the impact is unknown (severity null), not zero.
 */
export function describePriceImpact(priceImpact: number | null | undefined) {
  if (priceImpact == null) return { text: "Unknown", severity: null };
  const pct = Math.abs(priceImpact);
  return {
    text: pct < 0.01 ? "<0.01%" : `${pct.toFixed(2)}%`,
    severity: pct >= 5 ? "high" : pct >= 1 ? "medium" : "low",
  } as const;
}

/**
 * True when the signed transaction can no longer land: RFQ quotes carry an
 * `expireAt` timestamp; aggregator quotes a `lastValidBlockHeight`.
 */
export function isOrderExpired(
  order: Pick<OrderResponse, "expireAt" | "lastValidBlockHeight">,
  { now, blockHeight }: { now: number; blockHeight: number },
): boolean {
  const expireAt = order.expireAt ? parseExpireAt(order.expireAt) : null;
  if (expireAt !== null && now >= expireAt) return true;
  return !!order.lastValidBlockHeight && blockHeight > Number(order.lastValidBlockHeight);
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

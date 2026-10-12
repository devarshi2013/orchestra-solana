import type { NextRequest } from "next/server";
import { z } from "zod";

import { pnlCardImage, type PnlCardData } from "@/components/share/pnl-card";
import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { strategiesConfigured, strategiesOff } from "@/server/db";
import { errorResponse, validationErrorResponse } from "@/server/http";
import { livePrices } from "@/server/prices";
import { portfolioHistory } from "@/server/portfolio/history";
import { profile } from "@/server/strategies/profile";

/**
 * GET ?wallet=&period=all|30d → a 1200×630 PNG of the wallet's P&L to share:
 * recorded holdings at Jupiter's live prices against their recorded cost.
 * Nothing is estimated: unpriced or unrecorded holdings are left out, a wallet
 * without recorded buys gets "No trades yet". The 30d change comes from the
 * stored portfolio history; with fewer than two days of it the card says so.
 */

const querySchema = z.object({
  wallet: base58AddressSchema,
  period: z.enum(["all", "30d"]).default("all"),
});

/** A token logo as a data URL, or null when it can't be fetched quickly (the card shows initials). */
async function logo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpe?g|gif|svg\+xml)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** How much unrealized P&L moved over the last 30 days, from stored history (null with under two days). */
async function monthChange(wallet: string) {
  const { points } = await portfolioHistory(wallet, "30d");
  const [first, last] = [points[0], points.at(-1)];
  if (!first || !last || points.length < 2 || first.value <= 0) return null;
  const pnl = last.pnl - first.pnl;
  return { pnl, pct: (pnl / first.value) * 100 };
}

async function card(wallet: string, period: "all" | "30d"): Promise<PnlCardData | null> {
  const { positions } = await profile(wallet);
  const recorded = positions.filter((p) => p.costBasis !== null && p.recordedAmount > 0);
  if (recorded.length === 0) return null;
  const prices = await livePrices(recorded.map((p) => p.mint));
  const rows = recorded.flatMap((p) => {
    const price = prices[p.mint]?.price;
    if (price === undefined) return [];
    const value = p.recordedAmount * price;
    const pnl = value - p.costBasis!;
    return [{ ...p, value, pnl, pnlPct: (pnl / p.costBasis!) * 100 }];
  });
  if (rows.length === 0) return null;
  const value = rows.reduce((sum, r) => sum + r.value, 0);
  const cost = rows.reduce((sum, r) => sum + r.costBasis!, 0);
  const pnl = value - cost;
  const change = period === "all" ? { pnl, pct: (pnl / cost) * 100 } : await monthChange(wallet);
  const top = [...rows].sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 3);
  const logos = await Promise.all(top.map((r) => logo(r.icon)));
  return { value, change, top: top.map((r, i) => ({ ...r, logo: logos[i] ?? null })) };
}

export async function GET(request: NextRequest) {
  if (!strategiesConfigured()) return strategiesOff();
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { wallet, period } = parsed.data;
  let data: PnlCardData | null;
  try {
    data = await card(wallet, period);
  } catch (error) {
    console.error(`[pnl-card] failed ${wallet}`, error);
    return errorResponse(502, "Couldn't build the P&L card");
  }
  return pnlCardImage({ wallet, period, data });
}

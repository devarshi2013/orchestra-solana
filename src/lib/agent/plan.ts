import { z } from "zod";

import type { Asset } from "@/lib/assets/registry";
import { MIN_LEG_USD } from "@/lib/invest/plan";

/** The assistant's final plan: what to buy with USDC, and why. Never executed by the assistant. */
export const planSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            kind: z.enum(["stock", "crypto"]),
            ticker: z.string().trim().min(1).max(20),
            usdcAmount: z.number().finite().positive(),
            reason: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    totalUsdc: z.number().finite().positive(),
    rankingMethod: z.string().trim().min(3).max(300),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;

/** A validated plan, with each item tied to its registry token (symbol, never a mint). */
export type AcceptedPlan = Omit<Plan, "items"> & {
  items: (Plan["items"][number] & { symbol: string; name: string })[];
};

const CENT = 0.01;

/**
 * Server-side checks on a submitted plan. Every message is written for the
 * model to act on, so a failed plan can be sent back for it to fix:
 * - every ticker resolves to exactly one registry asset of that kind (not USDC);
 * - every item meets Jupiter's minimum order size;
 * - totalUsdc equals the items' sum, and fits the wallet's USDC balance.
 */
export function validatePlan(
  input: unknown,
  ctx: { assets: readonly Asset[]; usdcBalance: number | null; minOrderUsd?: number },
): { ok: true; plan: AcceptedPlan } | { ok: false; errors: string[] } {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, errors: [`Malformed plan: ${z.prettifyError(parsed.error)}`] };
  const plan = parsed.data;
  const minOrder = ctx.minOrderUsd ?? MIN_LEG_USD;
  const errors: string[] = [];
  const seen = new Set<string>();
  const items: AcceptedPlan["items"] = [];

  for (const item of plan.items) {
    const wanted = item.ticker.replace(/^\$/, "").toUpperCase();
    const ofKind = ctx.assets.filter((a) => a.kind === item.kind);
    const bySymbol = ofKind.filter((a) => a.symbol.replace(/^\$/, "").toUpperCase() === wanted);
    const byTicker = ofKind.filter((a) => a.ticker.toUpperCase() === wanted);
    const matches = bySymbol.length === 1 ? bySymbol : byTicker;
    if (matches.length === 0) {
      errors.push(
        `"${item.ticker}" is not a ${item.kind} in the asset registry; use listAssets to pick one.`,
      );
      continue;
    }
    if (matches.length > 1) {
      errors.push(
        `"${item.ticker}" is ambiguous (${matches.map((a) => a.symbol).join(", ")}); use the token symbol.`,
      );
      continue;
    }
    const asset = matches[0]!;
    if (asset.cash) {
      errors.push(`"${item.ticker}" is USDC, which the plan spends; leave it out.`);
      continue;
    }
    if (seen.has(asset.mint)) {
      errors.push(`"${item.ticker}" appears more than once; combine it into one item.`);
      continue;
    }
    seen.add(asset.mint);
    if (item.usdcAmount < minOrder) {
      errors.push(
        `"${item.ticker}" is ${item.usdcAmount} USDC, below the ${minOrder} USDC minimum order size.`,
      );
    }
    items.push({ ...item, symbol: asset.symbol, name: asset.name });
  }

  const sum = plan.items.reduce((total, item) => total + item.usdcAmount, 0);
  if (Math.abs(sum - plan.totalUsdc) > CENT) {
    errors.push(
      `totalUsdc is ${plan.totalUsdc} but the items add up to ${Number(sum.toFixed(6))}.`,
    );
  }
  if (ctx.usdcBalance === null) {
    errors.push(
      "The wallet's USDC balance couldn't be read, so the plan can't be checked; tell the user.",
    );
  } else if (plan.totalUsdc > ctx.usdcBalance + 1e-9) {
    errors.push(`totalUsdc ${plan.totalUsdc} exceeds the wallet's ${ctx.usdcBalance} USDC.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, plan: { ...plan, items } };
}

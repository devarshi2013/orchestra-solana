import { z } from "zod";

import { resolveTicker } from "@/lib/stocks/registry";
import type { StockEntry } from "@/lib/stocks/types";
import { MIN_ORDER_USD } from "@/lib/units";

const planItemSchema = z
  .object({
    kind: z.enum(["stock"]),
    ticker: z.string().trim().min(1).max(20),
    usdcAmount: z.number().finite().positive(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

/** The assistant's final plan: what to buy with USDC, and why. Never executed by the assistant. */
export const planSchema = z
  .object({
    items: z.array(planItemSchema).min(1).max(20),
    totalUsdc: z.number().finite().positive(),
    rankingMethod: z.string().trim().min(3).max(300),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;

/** A validated plan, with each item tied to its registry token (symbol, never a mint). */
export const acceptedPlanSchema = planSchema.extend({
  items: z
    .array(planItemSchema.extend({ symbol: z.string(), name: z.string() }))
    .min(1)
    .max(20),
});
export type AcceptedPlan = z.infer<typeof acceptedPlanSchema>;

const CENT = 0.01;

/**
 * Server-side checks on a submitted plan. Every message is written for the
 * model to act on, so a failed plan can be sent back for it to fix:
 * - every ticker (or token symbol) is a company in the stock registry, once;
 * - every item meets Jupiter's minimum order size;
 * - totalUsdc equals the items' sum, and fits the wallet's USDC balance.
 */
export function validatePlan(
  input: unknown,
  ctx: { stocks: readonly StockEntry[]; usdcBalance: number | null; minOrderUsd?: number },
): { ok: true; plan: AcceptedPlan } | { ok: false; errors: string[] } {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, errors: [`Malformed plan: ${z.prettifyError(parsed.error)}`] };
  const plan = parsed.data;
  const minOrder = ctx.minOrderUsd ?? MIN_ORDER_USD;
  const errors: string[] = [];
  const seen = new Set<string>();
  const items: AcceptedPlan["items"] = [];

  for (const item of plan.items) {
    const found = resolveTicker(item.ticker, ctx.stocks);
    if (!found.ok) {
      errors.push(found.reason);
      continue;
    }
    if (seen.has(found.ticker)) {
      errors.push(`"${item.ticker}" appears more than once; combine it into one item.`);
      continue;
    }
    seen.add(found.ticker);
    if (item.usdcAmount < minOrder) {
      errors.push(
        `"${item.ticker}" is ${item.usdcAmount} USDC, below the ${minOrder} USDC minimum order size.`,
      );
    }
    // A token symbol pins that issuer; a company ticker lets the buy pick the issuer.
    const pinned =
      found.candidates.length === 1 &&
      found.candidates[0]!.symbol.toUpperCase() === item.ticker.replace(/^\$/, "").toUpperCase();
    items.push({
      ...item,
      ticker: found.ticker,
      symbol: pinned ? found.candidates[0]!.symbol : found.ticker,
      name: found.companyName,
    });
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

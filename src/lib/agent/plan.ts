import { z } from "zod";

import { normalizeName, type StockIndex } from "@/lib/stocks/group";
import { ISSUERS } from "@/lib/stocks/issuers";
import { MIN_ORDER_USD } from "@/lib/units";

const planItemSchema = z
  .object({
    kind: z.enum(["stock"]),
    /** A stock token's symbol (NVDAx, NVDAon, MU): which issuer's token to buy. */
    symbol: z.string().trim().min(1).max(20),
    usdcAmount: z.number().finite().positive(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

/** The assistant's final plan: what to buy with USDC, and why. Never executed by the assistant. */
const planSchema = z
  .object({
    items: z.array(planItemSchema).min(1).max(20),
    totalUsdc: z.number().finite().positive(),
    rankingMethod: z.string().trim().min(3).max(300),
  })
  .strict();

/** A validated plan, each item tied to a listed token (its symbol, never a mint) and company. */
export type AcceptedPlan = Omit<z.infer<typeof planSchema>, "items"> & {
  items: (z.infer<typeof planItemSchema> & {
    ticker: string;
    name: string;
    issuer: string | null;
  })[];
};

const CENT = 0.01;

/**
 * Server-side checks on a submitted plan. Every message is written for the
 * model to act on, so a failed plan can be sent back for it to fix:
 * - every symbol is a listed stock token (a company ticker names its tokens), once;
 * - every item meets Jupiter's minimum order size;
 * - totalUsdc equals the items' sum, and fits the wallet's USDC balance.
 */
export function validatePlan(
  input: unknown,
  ctx: {
    stocks: Pick<StockIndex, "bySymbol" | "byName">;
    usdcBalance: number | null;
    minOrderUsd?: number;
  },
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
    const found = ctx.stocks.bySymbol.get(normalizeName(item.symbol));
    if (!found) {
      const company = ctx.stocks.byName.get(normalizeName(item.symbol));
      errors.push(
        company
          ? `"${item.symbol}" is a company ticker; name one of its tokens: ${company.tokens.map((t) => t.symbol).join(", ")}.`
          : `"${item.symbol}" isn't a listed stock token; use a symbol from searchStocks.`,
      );
      continue;
    }
    const { stock, token } = found;
    if (seen.has(token.mint)) {
      errors.push(`"${item.symbol}" appears more than once; combine it into one item.`);
      continue;
    }
    seen.add(token.mint);
    if (item.usdcAmount < minOrder) {
      errors.push(
        `"${item.symbol}" is ${item.usdcAmount} USDC, below the ${minOrder} USDC minimum order size.`,
      );
    }
    items.push({
      ...item,
      symbol: token.symbol,
      ticker: stock.ticker,
      name: stock.name,
      issuer: token.issuer ? ISSUERS[token.issuer].label : null,
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

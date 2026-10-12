import { z } from "zod";

import type { StrategyProposal } from "@/lib/assistant/views";
import { normalizeName, type StockIndex } from "@/lib/stocks/group";
import { conditionSchema, type Condition } from "@/lib/strategies/types";
import { MIN_ORDER_USD } from "@/lib/units";

/** The model's flat input: one `value` read as a price, a percent or a number of days by `type`. */
const proposalSchema = z
  .object({
    symbol: z.string().trim().min(1).max(20),
    usdcAmount: z.number().finite().positive(),
    condition: z
      .object({
        type: z.enum(["price_below", "price_above", "change_below", "change_above", "every"]),
        value: z.number().finite(),
      })
      .strict(),
    repeat: z.boolean(),
  })
  .strict();

const toCondition = ({ type, value }: z.infer<typeof proposalSchema>["condition"]) =>
  type === "every"
    ? { type, days: value }
    : type === "price_below" || type === "price_above"
      ? { type, price: value }
      : { type, pct: value };

/**
 * Checks a proposed conditional buy, with every message written for the model
 * to act on: the symbol is a listed token (never a ticker), the amount meets
 * the minimum order, the condition is valid and not already met (a price
 * condition needs the token's live price on the right side of it).
 */
export function validateStrategy(
  input: unknown,
  stocks: Pick<StockIndex, "bySymbol" | "byName">,
): { ok: true; strategy: StrategyProposal } | { ok: false; errors: string[] } {
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, errors: [`Malformed strategy: ${z.prettifyError(parsed.error)}`] };
  const { symbol, usdcAmount, repeat } = parsed.data;
  const found = stocks.bySymbol.get(normalizeName(symbol));
  if (!found) {
    const company = stocks.byName.get(normalizeName(symbol));
    return {
      ok: false,
      errors: [
        company
          ? `"${symbol}" is a company ticker; name one of its tokens: ${company.tokens.map((t) => t.symbol).join(", ")}.`
          : `"${symbol}" isn't a listed stock token; use a symbol from searchStocks.`,
      ],
    };
  }
  const { stock, token } = found;
  const errors: string[] = [];
  if (usdcAmount < MIN_ORDER_USD)
    errors.push(`${usdcAmount} USDC is below the ${MIN_ORDER_USD} USDC minimum order size.`);
  const condition = conditionSchema.safeParse(toCondition(parsed.data.condition));
  if (!condition.success) {
    errors.push(`Invalid condition: ${z.prettifyError(condition.error)}`);
  } else {
    errors.push(...priceProblems(condition.data, token.price, token.symbol));
  }
  if (errors.length || !condition.success) return { ok: false, errors };
  return {
    ok: true,
    strategy: {
      symbol: token.symbol,
      ticker: stock.ticker,
      name: stock.name,
      mint: token.mint,
      usdcAmount,
      condition: condition.data,
      repeat,
      currentPrice: token.price,
    },
  };
}

/** A price condition needs a live price, and mustn't be met already. */
function priceProblems(condition: Condition, price: number | null, symbol: string): string[] {
  if (condition.type !== "price_below" && condition.type !== "price_above") return [];
  if (price === null)
    return [`${symbol} has no live price, so a price condition can't be watched.`];
  if (condition.type === "price_below" && condition.price >= price)
    return [
      `${symbol} is already at $${price}, at or below $${condition.price}; buy it now instead.`,
    ];
  if (condition.type === "price_above" && condition.price <= price)
    return [
      `${symbol} is already at $${price}, at or above $${condition.price}; buy it now instead.`,
    ];
  return [];
}

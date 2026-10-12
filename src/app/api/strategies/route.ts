import { normalizeName } from "@/lib/stocks/group";
import { newStrategySchema, type Strategy } from "@/lib/strategies/types";
import { requireWallet } from "@/server/auth/session";
import { db, T } from "@/server/db";
import { errorResponse, jsonOr502, validationErrorResponse } from "@/server/http";
import { listStrategies, toStrategy } from "@/server/strategies/store";
import { stockUniverse } from "@/server/stocks/universe";

/** GET → the signed-in wallet's strategies (cancelled ones left out), newest first. */
export async function GET(request: Request) {
  const wallet = requireWallet(request);
  if (wallet instanceof Response) return wallet;
  return jsonOr502("[strategies] list failed", () => listStrategies(wallet));
}

/**
 * POST { symbol, usdcAmount, condition, repeat } → the new strategy. The token
 * comes from the live stock universe: a token symbol (NVDAx) is that token, a
 * company ticker (NVDA) is its most liquid token.
 */
export async function POST(request: Request) {
  const wallet = requireWallet(request);
  if (wallet instanceof Response) return wallet;
  const parsed = newStrategySchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { symbol, usdcAmount, condition, repeat } = parsed.data;
  return jsonOr502("[strategies] create failed", async () => {
    const { bySymbol, byName } = await stockUniverse();
    const name = normalizeName(symbol);
    const stock = bySymbol.get(name)?.stock ?? byName.get(name);
    const token = bySymbol.get(name)?.token ?? stock?.tokens[0];
    if (!stock || !token) return errorResponse(404, `${symbol} isn't a listed stock token`);
    const next =
      condition.type === "every" ? new Date(Date.now() + condition.days * 86_400_000) : null;
    const sql = await db();
    await sql`insert into ${sql(T.users)} (wallet) values (${wallet}) on conflict (wallet) do nothing`;
    const [row] = await sql`
      insert into ${sql(T.strategies)} (wallet, mint, symbol, ticker, name, usdc_amount, condition, repeat, next_run_at)
      values (${wallet}, ${token.mint}, ${token.symbol}, ${stock.ticker}, ${stock.name}, ${usdcAmount},
        ${sql.json(condition)}, ${repeat}, ${next})
      returning *`;
    return Response.json(toStrategy(row!) satisfies Strategy, { status: 201 });
  });
}

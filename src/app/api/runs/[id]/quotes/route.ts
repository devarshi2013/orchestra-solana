import type { NextRequest } from "next/server";

import { handle, requireWallet } from "@/server/invest/route";
import { getOwnedRun } from "@/server/invest/service";
import { getOrder } from "@/server/jupiter/swap";
import { getMintDecimals } from "@/server/solana/rpc";

/**
 * GET → indicative quotes for the review screen: each unfinished leg at its
 * planned size, without a taker (no transaction). Legs are re-quoted for
 * real, from live balances, right before signing.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/runs/[id]/quotes">) {
  return handle(async () => {
    const owner = await requireWallet();
    const run = await getOwnedRun((await ctx.params).id, owner);
    const quotes = [];
    for (const leg of run.legs) {
      if (leg.status === "succeeded" || leg.status === "skipped") continue;
      try {
        const [order, decimals] = await Promise.all([
          getOrder({
            inputMint: leg.inputMint,
            outputMint: leg.outputMint,
            amount: leg.plannedAmount,
          }),
          getMintDecimals(leg.mint),
        ]);
        quotes.push({
          index: leg.index,
          inAmount: order.inAmount,
          outAmount: order.outAmount,
          priceImpact: order.priceImpact ?? null,
          feeBps: order.feeBps ?? null,
          router: order.router,
          decimals,
        });
      } catch (error) {
        quotes.push({
          index: leg.index,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return Response.json({ quotes });
  });
}

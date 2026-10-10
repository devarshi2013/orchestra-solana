import type { NextRequest } from "next/server";
import { z } from "zod";

import { friendlyError } from "@/lib/friendly-error";
import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { STOCKS } from "@/lib/stocks/registry";
import { USDC_MINT } from "@/lib/tokens";
import { toUnits, USDC_DECIMALS } from "@/lib/units";
import { errorResponse } from "@/server/http";
import { getWalletBalances } from "@/server/solana/rpc";

const REGISTRY_MINTS = new Set(STOCKS.map((s) => s.mint));
const querySchema = z.object({ wallet: base58AddressSchema, mint: z.string() });

/** GET ?wallet&mint → the wallet's USDC and its balance of one registry token (for the trade panel). */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success || !REGISTRY_MINTS.has(parsed.data.mint))
    return errorResponse(400, "Unknown wallet or token");
  try {
    const balances = await getWalletBalances(parsed.data.wallet);
    const token = balances[parsed.data.mint];
    const usdc = balances[USDC_MINT];
    return Response.json(
      {
        usdc: usdc ? toUnits(usdc.amount, USDC_DECIMALS) : 0,
        token: token ? toUnits(token.amount, token.decimals) : 0,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[markets] balance failed", error);
    return errorResponse(502, friendlyError(error));
  }
}

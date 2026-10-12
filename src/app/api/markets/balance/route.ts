import type { NextRequest } from "next/server";
import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { USDC_MINT } from "@/lib/tokens";
import { toUnits, USDC_DECIMALS } from "@/lib/units";
import { errorResponse, jsonOr502, validationErrorResponse } from "@/server/http";
import { getWalletBalances } from "@/server/solana/rpc";
import { findStockToken } from "@/server/stocks/universe";

const querySchema = z.object({ wallet: base58AddressSchema, mint: base58AddressSchema });

/** GET ?wallet&mint → the wallet's USDC and its balance of one listed stock token (for the trade panel). */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { wallet, mint } = parsed.data;
  return jsonOr502("[markets] balance failed", async () => {
    if (!(await findStockToken(mint))) return errorResponse(400, "Not a listed stock token");
    const { [mint]: token, [USDC_MINT]: usdc } = await getWalletBalances(wallet);
    return {
      usdc: usdc ? toUnits(usdc.amount, USDC_DECIMALS) : 0,
      token: token ? toUnits(token.amount, token.decimals) : 0,
    };
  });
}

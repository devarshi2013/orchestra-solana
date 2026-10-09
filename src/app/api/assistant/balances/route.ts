import type { NextRequest } from "next/server";
import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { walletFunds } from "@/server/agent/quote";
import { validationErrorResponse } from "@/server/http";

/** GET ?wallet=<address> → its USDC and SOL, for the plan's pre-flight checks. */
export async function GET(request: NextRequest) {
  const wallet = z
    .object({ wallet: base58AddressSchema })
    .safeParse({ wallet: request.nextUrl.searchParams.get("wallet") });
  if (!wallet.success) return validationErrorResponse(wallet.error);
  return Response.json(await walletFunds(wallet.data.wallet), {
    headers: { "cache-control": "no-store" },
  });
}

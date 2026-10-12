import type { NextRequest } from "next/server";

import { base58AddressSchema } from "@/lib/jupiter/schemas";

import { createSignInMessage } from "@/server/auth/sign-in";
import { strategiesConfigured, strategiesOff } from "@/server/db";
import { errorResponse, jsonOr502 } from "@/server/http";

/** GET ?wallet= → { nonce, message }: the SIWS message for that wallet to sign (single use, 10 minutes). */
export async function GET(request: NextRequest) {
  if (!strategiesConfigured()) return strategiesOff();
  const wallet = base58AddressSchema.safeParse(request.nextUrl.searchParams.get("wallet"));
  if (!wallet.success) return errorResponse(400, "Invalid wallet");
  const { host, origin } = request.nextUrl;
  return jsonOr502("[auth] nonce failed", () =>
    createSignInMessage({ host, origin, wallet: wallet.data }),
  );
}

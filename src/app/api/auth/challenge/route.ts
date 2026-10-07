import type { NextRequest } from "next/server";
import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { issueChallenge } from "@/server/auth/session";
import { validationErrorResponse } from "@/server/http";

/** GET ?address=<wallet> → the Sign-In With Solana message for the wallet to sign. */
export async function GET(request: NextRequest) {
  const address = z
    .object({ address: base58AddressSchema })
    .safeParse({ address: request.nextUrl.searchParams.get("address") });
  if (!address.success) return validationErrorResponse(address.error);
  const message = await issueChallenge(address.data.address, request.nextUrl.host);
  return Response.json({ message });
}

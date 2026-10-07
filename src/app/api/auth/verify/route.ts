import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { base64ToBytes } from "@/lib/solana";
import { completeSignIn } from "@/server/auth/session";
import { errorResponse, validationErrorResponse } from "@/server/http";

const bodySchema = z.object({
  address: base58AddressSchema,
  /** base64 ed25519 signature of the challenge message. */
  signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/, "signature must be 64 bytes, base64"),
});

/** POST { address, signature } → starts a session if the wallet signed our challenge. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const wallet = await completeSignIn(parsed.data.address, base64ToBytes(parsed.data.signature));
  if (!wallet)
    return errorResponse(
      401,
      "Signature didn't match. Request a new sign-in message and try again.",
    );
  return Response.json({ wallet });
}

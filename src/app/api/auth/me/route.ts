import type { MeResponse } from "@/lib/strategies/types";
import { sessionWallet } from "@/server/auth/session";

/** GET → the signed-in wallet, or null. */
export function GET(request: Request) {
  return Response.json({ wallet: sessionWallet(request) } satisfies MeResponse, {
    headers: { "cache-control": "no-store" },
  });
}

import { connection } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import { errorResponse } from "@/server/http";
import { heroStocks } from "@/server/markets/screener";

/** GET → the stocks the home hero's chart rotates through (top by 24h volume, with working history; cached 10 min). */
export async function GET() {
  await connection();
  try {
    return Response.json(await heroStocks(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[markets] hero stocks failed", error);
    return errorResponse(502, friendlyError(error));
  }
}

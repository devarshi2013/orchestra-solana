import type { NextRequest } from "next/server";
import { z } from "zod";

import { HISTORY_PERIODS } from "@/lib/strategies/types";
import { requireWallet } from "@/server/auth/session";
import { errorResponse, jsonOr502 } from "@/server/http";
import { portfolioHistory } from "@/server/portfolio/history";

const periodSchema = z.enum(HISTORY_PERIODS);

/** GET ?period=7d|30d|90d|1y → the signed-in wallet's portfolio, one point per day, today live. */
export async function GET(request: NextRequest) {
  const wallet = requireWallet(request);
  if (wallet instanceof Response) return wallet;
  const period = periodSchema.safeParse(request.nextUrl.searchParams.get("period"));
  if (!period.success) return errorResponse(400, "period must be 7d, 30d, 90d or 1y");
  return jsonOr502(
    "[portfolio] history failed",
    () => portfolioHistory(wallet, period.data),
    "private, no-store",
  );
}

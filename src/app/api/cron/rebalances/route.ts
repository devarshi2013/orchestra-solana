import type { NextRequest } from "next/server";

import { isAuthorizedCron } from "@/server/cron";
import { errorResponse } from "@/server/http";
import { checkDueInvestments } from "@/server/invest/notify";

export const maxDuration = 300;
const TIME_BUDGET_MS = 240_000;

/**
 * Daily: checks investments whose rebalance check is due and notifies owners
 * (in-app, email, push) with a "Review & rebalance" link. Never trades.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization")))
    return errorResponse(401, "Unauthorized");
  const started = Date.now();
  try {
    return Response.json(
      await checkDueInvestments(new Date(), () => Date.now() - started > TIME_BUDGET_MS),
    );
  } catch (error) {
    console.error("[cron/rebalances] failed", error);
    return errorResponse(500, "Rebalance check failed");
  }
}

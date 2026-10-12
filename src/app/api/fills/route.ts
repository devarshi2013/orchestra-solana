import { newFillSchema } from "@/lib/strategies/types";
import { strategiesConfigured, strategiesOff } from "@/server/db";
import { errorResponse, jsonOr502, validationErrorResponse } from "@/server/http";
import { FillError, recordFill } from "@/server/strategies/fills";

/**
 * POST { signature, strategyId? } → the recorded fill. The swap is read back
 * from the chain, so the browser can't claim a fill that didn't happen.
 */
export async function POST(request: Request) {
  if (!strategiesConfigured()) return strategiesOff();
  const parsed = newFillSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  return jsonOr502("[fills] record failed", async () => {
    try {
      return await recordFill(parsed.data.signature, parsed.data.strategyId ?? null);
    } catch (error) {
      if (error instanceof FillError) return errorResponse(400, error.message);
      throw error;
    }
  });
}

import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";

import { explainRebalance } from "@/lib/assets/symphony-tools";
import { anthropic } from "@/server/agent/client";
import { explainWithAi } from "@/server/agent/explain";
import { agentRateLimiter } from "@/server/agent/rate-limit";
import { handle, requireWallet } from "@/server/invest/route";
import { InvestError } from "@/server/invest/service";

export const maxDuration = 60;

type Ctx = RouteContext<"/api/investments/[id]/explanation">;

async function load(ctx: Ctx) {
  const owner = await requireWallet();
  const { id } = await ctx.params;
  const result = await explainRebalance({ symphonyId: id }, owner);
  if (!result.data) throw new InvestError(404, result.reason);
  return { owner, explanation: result.data };
}

/** GET → why this rebalance has trades: explainRebalance's data and a plain summary of it. */
export async function GET(_request: NextRequest, ctx: Ctx) {
  return handle(async () => Response.json((await load(ctx)).explanation));
}

/**
 * POST → a short AI explanation generated only from that same data
 * (recomputed here, never taken from the browser). `text` is null with a
 * `reason` when the AI isn't available.
 */
export async function POST(_request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { owner, explanation } = await load(ctx);
    const client = anthropic();
    if (!client) return Response.json({ text: null, reason: "The AI isn't configured." });
    const slot = agentRateLimiter.acquire(owner);
    if (!slot.ok) return Response.json({ text: null, reason: slot.reason });
    try {
      // The model gets the data only, not our own wording of it.
      const data = { ...explanation, summary: undefined };
      return Response.json({ text: await explainWithAi(client, data), reason: null });
    } catch (error) {
      const reason =
        error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)
          ? "The AI is unavailable: its Anthropic account is out of credits."
          : "The AI explanation couldn't be generated right now.";
      if (!(error instanceof Anthropic.APIError)) console.error("[explain] failed", error);
      return Response.json({ text: null, reason });
    } finally {
      slot.release();
    }
  });
}

import type { Prisma } from "@/generated/prisma/client";
import { createInvestmentSchema } from "@/lib/invest/schemas";
import { nextDueAt } from "@/lib/invest/schedule";
import { trackMints } from "@/lib/market/store";
import { validateSymphony } from "@/lib/symphony/validate";
import { listedAssets } from "@/server/assets/registry";
import { db } from "@/server/db";
import { handle, readJson, requireWallet } from "@/server/invest/route";
import { InvestError, universeOf } from "@/server/invest/service";

/** GET → the signed-in wallet's investments. */
export async function GET() {
  return handle(async () => {
    const owner = await requireWallet();
    const investments = await db.investment.findMany({
      where: { owner, status: { not: "closed" } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(investments);
  });
}

/** POST → starts a live symphony for the signed-in wallet. */
export async function POST(request: Request) {
  return handle(async () => {
    const owner = await requireWallet();
    const body = await readJson(request, createInvestmentSchema);
    // The registry is the only source of mints: anything else is refused.
    const { isListed } = await listedAssets();
    const issues = validateSymphony(body.symphony, { isKnownMint: isListed });
    if (issues.length > 0) {
      throw new InvestError(
        400,
        `Fix the symphony first: ${issues.map((i) => i.message).join("; ")}`,
      );
    }
    await trackMints(universeOf(body.symphony));
    const investment = await db.investment.create({
      data: {
        owner,
        name: body.symphony.name,
        symphony: body.symphony as unknown as Prisma.InputJsonValue,
        sourceDraftId: body.sourceDraftId,
        rebalance: body.rebalance as unknown as Prisma.InputJsonValue,
        driftThresholdPct: body.driftThresholdPct,
        notifyEmail: body.notifyEmail ?? null,
        nextDueAt: nextDueAt(body.rebalance, new Date()),
      },
    });
    return Response.json(investment, { status: 201 });
  });
}

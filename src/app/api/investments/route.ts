import { connection } from "next/server";
import { createInvestmentSchema } from "@/lib/invest/schemas";
import { db } from "@/server/db";
import { handle, readJson, requireWallet } from "@/server/invest/route";
import { createInvestment } from "@/server/invest/service";

/** GET → the signed-in wallet's investments. */
export async function GET() {
  // Per-request data: never prerendered at build time.
  await connection();
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
    return Response.json(await createInvestment(owner, body), { status: 201 });
  });
}

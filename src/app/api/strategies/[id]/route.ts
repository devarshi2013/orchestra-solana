import { z } from "zod";

import { requireWallet } from "@/server/auth/session";
import { db, T } from "@/server/db";
import { errorResponse, jsonOr502, validationErrorResponse } from "@/server/http";
import { toStrategy } from "@/server/strategies/store";

const idSchema = z.uuid();
const updateSchema = z.object({ status: z.enum(["cancelled", "watching"]) });

/** PATCH { status: "cancelled" | "watching" } → the updated strategy (owner only; "watching" re-arms it). */
export async function PATCH(request: Request, { params }: RouteContext<"/api/strategies/[id]">) {
  const wallet = requireWallet(request);
  if (wallet instanceof Response) return wallet;
  const id = idSchema.safeParse((await params).id);
  const body = updateSchema.safeParse(await request.json().catch(() => undefined));
  if (!id.success) return errorResponse(404, "Strategy not found");
  if (!body.success) return validationErrorResponse(body.error);
  return jsonOr502("[strategies] update failed", async () => {
    const sql = await db();
    const [row] = await sql`
      update ${sql(T.strategies)} set status = ${body.data.status}
      where id = ${id.data} and wallet = ${wallet} returning *`;
    return row ? toStrategy(row) : errorResponse(404, "Strategy not found");
  });
}

/** DELETE → removes the strategy (owner only). */
export async function DELETE(request: Request, { params }: RouteContext<"/api/strategies/[id]">) {
  const wallet = requireWallet(request);
  if (wallet instanceof Response) return wallet;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return errorResponse(404, "Strategy not found");
  return jsonOr502("[strategies] delete failed", async () => {
    const sql = await db();
    const [row] =
      await sql`delete from ${sql(T.strategies)} where id = ${id.data} and wallet = ${wallet} returning id`;
    return row ? new Response(null, { status: 204 }) : errorResponse(404, "Strategy not found");
  });
}

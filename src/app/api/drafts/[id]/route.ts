import type { NextRequest } from "next/server";
import { z } from "zod";

import { trackMints } from "@/lib/market/store";
import { collectMints } from "@/lib/symphony/mints";
import { symphonySchema } from "@/lib/symphony/schema";
import { db } from "@/server/db";
import { errorResponse, validationErrorResponse } from "@/server/http";

/** Drafts are small; refuse anything that isn't plausibly one. */
const MAX_BODY_BYTES = 200_000;

const idSchema = z.uuid();
const bodySchema = z.object({ symphony: symphonySchema });

/** GET a draft saved by /create. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/drafts/[id]">) {
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return validationErrorResponse(id.error);
  try {
    const draft = await db.symphonyDraft.findUnique({ where: { id: id.data } });
    if (!draft) return errorResponse(404, "Draft not found");
    return Response.json({
      id: draft.id,
      symphony: draft.symphony,
      updatedAt: draft.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[drafts] load failed", error);
    return errorResponse(500, "Couldn't load the draft");
  }
}

/**
 * PUT creates or replaces a draft. The tree only has to parse (an unfinished
 * draft is fine); its mints are tracked so the price sync starts fetching
 * their history.
 */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/drafts/[id]">) {
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return validationErrorResponse(id.error);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return errorResponse(413, "Draft is too large");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return errorResponse(400, "Body must be JSON");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { symphony } = parsed.data;
  try {
    const draft = await db.symphonyDraft.upsert({
      where: { id: id.data },
      create: { id: id.data, name: symphony.name, symphony },
      update: { name: symphony.name, symphony },
    });
    await trackMints([...collectMints(symphony.root)]);
    return Response.json({ id: draft.id, updatedAt: draft.updatedAt.toISOString() });
  } catch (error) {
    console.error("[drafts] save failed", error);
    return errorResponse(500, "Couldn't save the draft");
  }
}

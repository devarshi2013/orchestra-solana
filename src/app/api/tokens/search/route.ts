import type { NextRequest } from "next/server";
import { z } from "zod";

import { upstreamErrorResponse, validationErrorResponse } from "@/server/http";
import { searchTokens } from "@/server/jupiter/tokens";

const searchQuerySchema = z.object({ query: z.string().trim().min(1).max(200) });

export async function GET(request: NextRequest) {
  const parsed = searchQuerySchema.safeParse({ query: request.nextUrl.searchParams.get("query") });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const tokens = await searchTokens(parsed.data.query, request.signal);
    return Response.json(tokens.slice(0, 20));
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}

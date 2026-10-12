import type { NextRequest } from "next/server";
import { z } from "zod";

import { anthropic } from "@/server/agent/client";
import { WalletRateLimiter } from "@/server/agent/rate-limit";
import { generateTitle } from "@/server/agent/title";
import {
  clientIp,
  errorResponse,
  unidentifiedClient,
  validationErrorResponse,
} from "@/server/http";

/** Titles are cheap, but still capped per client: 60 an hour. */
const titleRateLimiter = new WalletRateLimiter(60);

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  /** The start of the first reply (the browser sends at most ~1,500 characters). */
  reply: z.string().max(4000).default(""),
});

/**
 * POST { message, reply } → { title } (3-6 words) for the chat history
 * sidebar, from a small fast model. On any failure the browser keeps the
 * title it made from the first message.
 */
export async function POST(request: NextRequest) {
  const client = anthropic();
  if (!client) return errorResponse(503, "The assistant isn't configured (ANTHROPIC_API_KEY)");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const ip = clientIp(request);
  if (!ip) return unidentifiedClient();
  const slot = titleRateLimiter.acquire(ip);
  if (!slot.ok) return errorResponse(429, slot.reason);
  try {
    const title = await generateTitle(
      client,
      parsed.data.message,
      parsed.data.reply.slice(0, 1500),
      AbortSignal.timeout(10_000),
    );
    return title ? Response.json({ title }) : errorResponse(502, "No usable title");
  } catch (error) {
    console.error("[agent] title failed", error instanceof Error ? error.message : error);
    return errorResponse(502, "Couldn't make a title");
  } finally {
    slot.release();
  }
}

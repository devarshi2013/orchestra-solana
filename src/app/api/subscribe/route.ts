import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { serverEnv } from "@/env/server";
import { WalletRateLimiter } from "@/server/agent/rate-limit";
import { errorResponse } from "@/server/http";
import { addSubscriber } from "@/server/subscribe";

/** Signups per IP: 10 an hour is plenty for people and stops a script. */
const subscribeRateLimiter = new WalletRateLimiter(10);

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  /** The honeypot: a field people never see. Anything in it means a bot. */
  website: z.string().optional(),
});

const clientIp = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

/**
 * POST { email, website? } → { ok: true } once the email is in the Resend
 * audience. Errors: 400 "Invalid email", 409 "Already subscribed", 429 too
 * many tries, 503 signup not configured, 502 "Something went wrong".
 * RESEND_API_KEY and RESEND_AUDIENCE_ID are read here, on the server, only.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(400, "Invalid email");
  // A bot filled the hidden field: answer like a success, add nothing.
  if (parsed.data.website) return Response.json({ ok: true });

  const apiKey = serverEnv.RESEND_API_KEY;
  const audienceId = serverEnv.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) return errorResponse(503, "Email signup isn't set up yet");

  const slot = subscribeRateLimiter.acquire(clientIp(request));
  if (!slot.ok) return errorResponse(429, "Too many tries. Please try again later.");
  try {
    const result = await addSubscriber(new Resend(apiKey), audienceId, parsed.data.email);
    return result === "already"
      ? errorResponse(409, "Already subscribed")
      : Response.json({ ok: true });
  } catch (error) {
    // Log the reason (never the email or key) and keep the answer generic.
    console.error("[subscribe] failed", error instanceof Error ? error.message : error);
    return errorResponse(502, "Something went wrong. Please try again.");
  } finally {
    slot.release();
  }
}

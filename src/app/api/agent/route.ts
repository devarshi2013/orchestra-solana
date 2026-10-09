import type Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { anthropic } from "@/server/agent/client";
import { runAgentTurn, type AgentEvent } from "@/server/agent/loop";
import { agentRateLimiter } from "@/server/agent/rate-limit";
import { runAgentTool } from "@/server/agent/tools";
import { errorResponse, validationErrorResponse } from "@/server/http";

export const maxDuration = 300;

/** Longest conversation the browser may send back, serialized. */
const MAX_HISTORY_BYTES = 600_000;

const contentBlock = z.object({ type: z.string() }).passthrough();
const historySchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.union([z.string(), z.array(contentBlock)]),
    }),
  )
  .max(400);

const bodySchema = z.object({
  /** The connected wallet (public address): balances and quotes are for it. */
  wallet: base58AddressSchema,
  message: z.string().trim().min(1).max(2000),
  /** The conversation so far, exactly as the previous `history` event returned it. */
  history: historySchema.default([]),
});

type StreamEvent =
  | AgentEvent
  | { type: "history"; messages: Anthropic.Beta.Messages.BetaMessageParam[] }
  | { type: "done" };

/** Best-effort client IP (Vercel sets x-forwarded-for) for rate limiting. */
const clientIp = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

/**
 * POST { wallet, message, history } → a Server-Sent Events stream of the
 * assistant's reply: text deltas, progress notes, tool activity, the
 * validated plan, errors, the updated `history`, then `done`.
 *
 * There is no database: the browser keeps the conversation and sends it back.
 * Thinking blocks are signed by the API, so they can't be altered; edited tool
 * results could only mislead the sender's own chat, and every plan is
 * re-validated here against the live registry and wallet before it's shown.
 * Never trades: buys happen in the browser, each signed by the user's wallet.
 */
export async function POST(request: NextRequest) {
  const client = anthropic();
  if (!client) return errorResponse(503, "The assistant isn't configured (ANTHROPIC_API_KEY)");

  const text = await request.text();
  if (text.length > MAX_HISTORY_BYTES + 10_000) {
    return errorResponse(413, "This conversation is too long; start a new chat");
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return errorResponse(400, "Body must be JSON");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { wallet, message } = parsed.data;
  const history = parsed.data.history as unknown as Anthropic.Beta.Messages.BetaMessageParam[];

  const slot = agentRateLimiter.acquire(clientIp(request));
  if (!slot.ok) {
    return Response.json(
      { error: { message: slot.reason } },
      { status: 429, headers: { "retry-after": String(slot.retryAfterS) } },
    );
  }

  const abort = new AbortController();
  const encoder = new TextEncoder();
  const started = Date.now();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        if (abort.signal.aborted) return;
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      };
      try {
        const result = await runAgentTurn({
          client,
          history,
          userText: message,
          runTool: (name, input) => runAgentTool(name, input, wallet),
          emit: send,
          signal: abort.signal,
        });
        send({ type: "history", messages: result.history });
        console.info(
          JSON.stringify({
            event: "agent.run",
            wallet: `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
            plan: Boolean(result.plan),
            ...result.usage,
            ms: Date.now() - started,
          }),
        );
      } catch (error) {
        console.error("[agent] run failed", error);
        send({ type: "error", message: "Something went wrong. Try again." });
      } finally {
        slot.release();
        send({ type: "done" });
        if (!abort.signal.aborted) controller.close();
      }
    },
    cancel() {
      abort.abort();
      slot.release();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

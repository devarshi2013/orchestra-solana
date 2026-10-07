import type { NextRequest } from "next/server";
import { z } from "zod";

import type Anthropic from "@anthropic-ai/sdk";

import type { Prisma } from "@/generated/prisma/client";
import { conversationTitle } from "@/lib/agent/transcript";
import { agentContextSchema } from "@/lib/assistant/schemas";
import { buildContext } from "@/server/assistant/context";
import { InvestError } from "@/server/invest/service";
import { hasAcceptedDisclosure } from "@/server/assistant/disclosure";
import { sessionWallet } from "@/server/auth/session";
import { db } from "@/server/db";
import { errorResponse, validationErrorResponse } from "@/server/http";
import { anthropic } from "@/server/agent/client";
import { runAgentTurn, type AgentEvent } from "@/server/agent/loop";
import { agentRateLimiter } from "@/server/agent/rate-limit";
import { runAgentTool } from "@/server/agent/tools";

export const maxDuration = 300;

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(2000),
  /** Sent by "Ask AI" panels: the symphony the user is looking at. */
  context: agentContextSchema.optional(),
});

type StreamEvent = AgentEvent | { type: "conversation"; id: string } | { type: "done" };

/**
 * POST { conversationId?, message } → a Server-Sent Events stream of the
 * assistant's reply: text deltas, progress notes, tool activity, the
 * validated plan, errors, then `done`. The conversation is stored server-side
 * for the signed-in wallet, so its history (and tool results) can't be forged
 * by the client. Rate-limited per wallet. Never trades.
 */
export async function POST(request: NextRequest) {
  const wallet = await sessionWallet();
  if (!wallet) return errorResponse(401, "Sign in with your wallet first");
  const client = anthropic();
  if (!client) return errorResponse(503, "The assistant isn't configured (ANTHROPIC_API_KEY)");

  if (!(await hasAcceptedDisclosure(wallet)))
    return errorResponse(403, "Accept the assistant's risk disclosure first");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { conversationId, message } = parsed.data;
  let context: string | undefined;
  if (parsed.data.context) {
    try {
      context = await buildContext(parsed.data.context, wallet);
    } catch (error) {
      if (error instanceof InvestError) return errorResponse(error.status, error.message);
      console.error("[agent] context failed", error);
      return errorResponse(503, "Couldn't load that symphony right now");
    }
  }

  let conversation;
  if (conversationId) {
    conversation = await db.agentConversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.owner !== wallet)
      return errorResponse(404, "Conversation not found");
  }

  const slot = agentRateLimiter.acquire(wallet);
  if (!slot.ok) {
    return Response.json(
      { error: { message: slot.reason } },
      { status: 429, headers: { "retry-after": String(slot.retryAfterS) } },
    );
  }

  conversation ??= await db.agentConversation.create({
    data: { owner: wallet, messages: [], title: conversationTitle(message) },
  });
  const id = conversation.id;
  const history = conversation.messages as unknown as Anthropic.Beta.Messages.BetaMessageParam[];
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
        send({ type: "conversation", id });
        const result = await runAgentTurn({
          client,
          history,
          userText: message,
          context,
          runTool: (name, input) => runAgentTool(name, input, wallet),
          emit: send,
          signal: abort.signal,
        });
        await db.agentConversation.update({
          where: { id },
          data: { messages: result.history as unknown as Prisma.InputJsonValue },
        });
        console.info(
          JSON.stringify({
            event: "agent.run",
            wallet: `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
            conversation: id,
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

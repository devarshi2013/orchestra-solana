import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { transcriptOf } from "@/lib/agent/transcript";
import type { ConversationSummary, TranscriptTurn } from "@/lib/assistant/views";
import { db } from "@/server/db";
import { InvestError } from "@/server/invest/service";

/** The wallet's chats, newest first, for /history. */
export async function listConversations(owner: string, take = 50): Promise<ConversationSummary[]> {
  const rows = await db.agentConversation.findMany({
    where: { owner },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { executions: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? "Untitled chat",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    executions: row._count.executions,
  }));
}

/** One chat replayed for display, with how many of its plans were bought. */
export async function getTranscript(
  id: string,
  owner: string,
): Promise<{ id: string; turns: TranscriptTurn[]; executions: number }> {
  const row = await db.agentConversation.findUnique({
    where: { id },
    include: { _count: { select: { executions: true } } },
  });
  if (!row || row.owner !== owner) throw new InvestError(404, "Conversation not found");
  return {
    id,
    turns: transcriptOf(row.messages as unknown as Anthropic.Beta.Messages.BetaMessageParam[]),
    executions: row._count.executions,
  };
}

"use client";

import { useCallback, useState } from "react";

import type { AcceptedPlan } from "@/lib/agent/plan";
import type { AgentContext } from "@/lib/assistant/schemas";
import type { SymphonyProposal, ToolCallView, TranscriptTurn } from "@/lib/assistant/views";

export type AssistantTurn = {
  role: "assistant";
  text: string;
  tools: ToolCallView[];
  progress: string;
  plan?: AcceptedPlan;
  /** createSymphony proposals, keyed by tool call id. */
  symphonies: (SymphonyProposal & { id: string })[];
  error?: string;
  done: boolean;
};
export type ChatTurn = { role: "user"; text: string } | AssistantTurn;

/** Parses a fetch body of Server-Sent Events into their JSON payloads. */
async function* readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (data) yield JSON.parse(data.slice(6)) as { type: string } & Record<string, unknown>;
    }
  }
}

/** A saved conversation's turns, as the chat shows them. */
export const fromTranscript = (turns: TranscriptTurn[]): ChatTurn[] =>
  turns.map((turn): ChatTurn =>
    turn.role === "user"
      ? turn
      : {
          role: "assistant",
          text: turn.text,
          tools: turn.tools,
          progress: "",
          plan: turn.plan ?? undefined,
          symphonies: turn.symphonies,
          done: true,
        },
  );

/**
 * A conversation with the assistant over POST /api/agent: streamed text,
 * progress, tool calls with their results, plans and symphony proposals.
 * Used by /assistant and the "Ask AI" panels (which send a context).
 */
export function useAgentChat(opts: { onConversation?: (id: string) => void } = {}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { onConversation } = opts;

  const updateLast = (change: (turn: AssistantTurn) => Partial<AssistantTurn>) =>
    setTurns((all) => {
      const last = all.at(-1);
      if (!last || last.role !== "assistant") return all;
      return [...all.slice(0, -1), { ...last, ...change(last) }];
    });

  const send = useCallback(
    async (text: string, context?: AgentContext) => {
      const message = text.trim();
      if (!message || busy) return;
      setBusy(true);
      setTurns((all) => [
        ...all,
        { role: "user", text: message },
        { role: "assistant", text: "", tools: [], symphonies: [], progress: "", done: false },
      ]);
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, conversationId: conversationId ?? undefined, context }),
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          updateLast(() => ({
            error: body?.error?.message ?? `Request failed (${response.status})`,
          }));
          return;
        }
        for await (const event of readEvents(response.body)) {
          switch (event.type) {
            case "conversation":
              setConversationId(event.id as string);
              onConversation?.(event.id as string);
              break;
            case "text":
              updateLast((t) => ({ text: t.text + (event.delta as string), progress: "" }));
              break;
            case "progress":
              updateLast(() => ({ progress: event.text as string }));
              break;
            case "tool":
              updateLast((t) => ({
                tools: [
                  ...t.tools,
                  {
                    id: event.id as string,
                    name: event.name as string,
                    input: event.input,
                    result: null,
                    ok: null,
                  },
                ],
              }));
              break;
            case "tool_result":
              updateLast((t) => ({
                tools: t.tools.map((call) =>
                  call.id === event.id
                    ? { ...call, result: event.content as string, ok: event.ok as boolean }
                    : call,
                ),
              }));
              break;
            case "plan":
              updateLast(() => ({ plan: event.plan as AcceptedPlan }));
              break;
            case "symphony":
              updateLast((t) => ({
                symphonies: [
                  ...t.symphonies,
                  { id: event.id as string, ...(event.proposal as SymphonyProposal) },
                ],
              }));
              break;
            case "error":
              updateLast(() => ({ error: event.message as string }));
              break;
          }
        }
      } catch {
        updateLast(() => ({ error: "Connection lost. Try again." }));
      } finally {
        updateLast(() => ({ done: true, progress: "" }));
        setBusy(false);
      }
    },
    [busy, conversationId, onConversation],
  );

  const reset = useCallback(() => {
    setConversationId(null);
    setTurns([]);
  }, []);

  /** Shows a saved conversation and continues it. */
  const restore = useCallback((id: string, saved: ChatTurn[]) => {
    setConversationId(id);
    setTurns(saved);
  }, []);

  return { turns, busy, conversationId, send, reset, restore };
}

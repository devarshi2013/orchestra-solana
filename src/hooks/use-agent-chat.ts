"use client";

import { useCallback, useRef, useState } from "react";

import type { AcceptedPlan } from "@/lib/agent/plan";
import type { ToolCallView } from "@/lib/assistant/views";

import type { BuyItem } from "./use-plan-buy";

/** A plan's purchase as it last stood, kept with the chat (statuses and Solscan links). */
export type SavedBuy = { items: BuyItem[]; stopped: string | null };

export type AssistantTurn = {
  role: "assistant";
  text: string;
  tools: ToolCallView[];
  progress: string;
  plan?: AcceptedPlan;
  buy?: SavedBuy;
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

/**
 * A conversation with the assistant over POST /api/agent: streamed text,
 * progress, tool calls with their results, and plans. There's no database:
 * the conversation lives in this hook, and each request sends it back as the
 * `history` the previous reply returned. `load` swaps in a saved chat (the
 * chat history keeps them in the browser). Without a wallet (a guest) the
 * assistant can research but not check balances, quote or plan.
 */
export function useAgentChat(wallet: string | null) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<unknown[]>([]);
  // The reply streaming now, so switching chats can stop it.
  const inFlight = useRef<AbortController | null>(null);

  const updateLast = (change: (turn: AssistantTurn) => Partial<AssistantTurn>) =>
    setTurns((all) => {
      const last = all.at(-1);
      if (!last || last.role !== "assistant") return all;
      return [...all.slice(0, -1), { ...last, ...change(last) }];
    });

  /**
   * Sends a message. `base` continues a saved chat instead of the one in this
   * hook (its turns and model history replace what's here).
   */
  const send = useCallback(
    async (text: string, base?: { turns: ChatTurn[]; history: unknown[] | null }) => {
      const message = text.trim();
      if (!message || busy) return;
      const sentHistory = base ? (base.history ?? []) : history;
      if (base) setHistory(sentHistory);
      const controller = new AbortController();
      inFlight.current = controller;
      setBusy(true);
      setTurns((all) => [
        ...(base ? base.turns : all),
        { role: "user", text: message },
        { role: "assistant", text: "", tools: [], progress: "", done: false },
      ]);
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wallet, message, history: sentHistory }),
          signal: controller.signal,
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
            case "history":
              setHistory(event.messages as unknown[]);
              break;
            case "error":
              updateLast(() => ({ error: event.message as string }));
              break;
          }
        }
      } catch {
        if (!controller.signal.aborted)
          updateLast(() => ({ error: "Connection lost. Try again." }));
      } finally {
        // A stopped reply's chat has already been swapped out: leave the new one alone.
        if (!controller.signal.aborted) updateLast(() => ({ done: true, progress: "" }));
        if (inFlight.current === controller) inFlight.current = null;
        setBusy(false);
      }
    },
    [busy, history, wallet],
  );

  /** Stops the reply streaming now, if any. */
  const stop = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setHistory([]);
    setTurns([]);
  }, [stop]);

  /** Opens a saved conversation (null history: continue as a fresh one for the model). */
  const load = useCallback(
    (saved: { turns: ChatTurn[]; history: unknown[] | null }) => {
      stop();
      setTurns(saved.turns);
      setHistory(saved.history ?? []);
    },
    [stop],
  );

  /** Changes one assistant turn, e.g. to record its plan's purchase. */
  const updateTurn = useCallback(
    (index: number, change: Partial<AssistantTurn>) =>
      setTurns((all) =>
        all.map((turn, i) =>
          i === index && turn.role === "assistant" ? { ...turn, ...change } : turn,
        ),
      ),
    [],
  );

  return { turns, history, busy, send, stop, reset, load, updateTurn };
}

"use client";

import { useCallback, useRef, useState } from "react";

import type { AcceptedPlan } from "@/lib/agent/plan";
import type {
  AgentEvent,
  StrategyProposal,
  StreamEvent,
  ToolCallView,
} from "@/lib/assistant/views";

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
  /** A proposed conditional buy, and its id once the user created it. */
  strategy?: StrategyProposal;
  strategyId?: string;
  error?: string;
  done: boolean;
  /** When the reply finished (ms), for the note's "as of" line; absent on replies saved before this was recorded. */
  at?: number;
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
      if (data) yield JSON.parse(data.slice(6)) as StreamEvent;
    }
  }
}

type EventChange<E = AgentEvent> = (turn: AssistantTurn, event: E) => Partial<AssistantTurn>;

/** How each event of a reply changes the turn it streams into. */
const EVENT_CHANGES: { [T in AgentEvent["type"]]: EventChange<Extract<AgentEvent, { type: T }>> } =
  {
    text: (turn, { delta }) => ({ text: turn.text + delta, progress: "" }),
    progress: (_, { text }) => ({ progress: text }),
    tool: (turn, { id, name, input }) => ({
      tools: [...turn.tools, { id, name, input, result: null, ok: null }],
    }),
    tool_result: (turn, { id, content, ok }) => ({
      tools: turn.tools.map((call) => (call.id === id ? { ...call, result: content, ok } : call)),
    }),
    plan: (_, { plan }) => ({ plan }),
    strategy: (_, { strategy }) => ({ strategy }),
    error: (_, { message }) => ({ error: message }),
  };

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
          if (event.type === "history") setHistory(event.messages);
          else if (event.type !== "done") {
            const change = Object.hasOwn(EVENT_CHANGES, event.type)
              ? (EVENT_CHANGES[event.type] as EventChange)
              : undefined;
            if (change) updateLast((turn) => change(turn, event));
          }
        }
      } catch {
        if (!controller.signal.aborted)
          updateLast(() => ({ error: "Connection lost. Try again." }));
      } finally {
        // A stopped reply's chat has already been swapped out: leave the new one alone.
        if (!controller.signal.aborted)
          updateLast(() => ({ done: true, progress: "", at: Date.now() }));
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

  /** The Stop button: ends the reply streaming now and keeps what has arrived so far. */
  const cancel = useCallback(() => {
    if (!inFlight.current) return;
    stop();
    updateLast((t) => (t.done ? {} : { done: true, progress: "", at: Date.now() }));
  }, [stop]);

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

  return { turns, history, busy, send, stop, cancel, reset, load, updateTurn };
}

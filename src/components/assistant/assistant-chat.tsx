"use client";

import { Loader2, Send, ShieldAlert, SquarePen, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AcceptedPlan } from "@/lib/agent/plan";
import { assistantApi } from "@/lib/api-client";
import type { ToolCallView } from "@/lib/assistant/views";

import { DataUsed, describeTool } from "./data-used";
import { Markdown } from "./markdown";
import { PlanCard } from "./plan-card";

type Turn =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      tools: ToolCallView[];
      progress: string;
      plan?: AcceptedPlan;
      error?: string;
      done: boolean;
    };

const SUGGESTIONS = [
  "I have 200 USDC. Suggest a mix of large tech stocks and major crypto, ranked by market cap.",
  "Which crypto had the best 1Y return with liquidity above $5M? Plan 100 USDC across the top 3.",
  "Compare NVDAx and SPYx: returns, valuation and price impact for a 50 USDC buy.",
];

/** Parses a fetch body of Server-Sent Events into { event, data } records. */
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
 * The assistant chat: streamed replies, a "data used" panel per answer, and
 * the plan card. `?c=<id>` reopens a saved chat (from /history).
 */
export function AssistantChat() {
  const router = useRouter();
  const requested = useSearchParams().get("c");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [boughtBefore, setBoughtBefore] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const loaded = useRef<string | null>(null);

  // Reopen a saved chat; skipped for the chat this page just started.
  useEffect(() => {
    if (!requested || requested === loaded.current) return;
    loaded.current = requested;
    let cancelled = false;
    assistantApi
      .conversation(requested)
      .then((saved) => {
        if (cancelled) return;
        setConversationId(saved.id);
        setBoughtBefore(saved.executions > 0);
        setLoadError(null);
        setTurns(
          saved.turns.map((turn): Turn =>
            turn.role === "user"
              ? turn
              : {
                  role: "assistant",
                  text: turn.text,
                  tools: turn.tools,
                  progress: "",
                  plan: turn.plan ?? undefined,
                  done: true,
                },
          ),
        );
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [requested]);

  const updateLast = (change: (turn: Extract<Turn, { role: "assistant" }>) => Partial<Turn>) =>
    setTurns((all) => {
      const last = all.at(-1);
      if (!last || last.role !== "assistant") return all;
      return [...all.slice(0, -1), { ...last, ...change(last) } as Turn];
    });

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    setTurns((all) => [
      ...all,
      { role: "user", text: message },
      { role: "assistant", text: "", tools: [], progress: "", done: false },
    ]);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId: conversationId ?? undefined }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        updateLast(() => ({
          error: body?.error?.message ?? `Request failed (${response.status})`,
          done: true,
        }));
        return;
      }
      for await (const event of readEvents(response.body)) {
        switch (event.type) {
          case "conversation": {
            const id = event.id as string;
            setConversationId(id);
            if (loaded.current !== id) {
              loaded.current = id;
              router.replace(`/assistant?c=${id}`, { scroll: false });
            }
            break;
          }
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
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldAlert />
        <AlertDescription>
          The assistant researches and proposes; it never trades on its own. Every figure comes from
          live data tools (open &ldquo;Data used&rdquo; to check them), and suggestions are limited
          to Orchestra&apos;s verified assets. You approve and sign every buy. This is research, not
          financial advice.
        </AlertDescription>
      </Alert>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {requested && turns.length === 0 && !loadError && <Skeleton className="h-40 w-full" />}

      {!requested && turns.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              className="rounded-lg border p-3 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4" aria-live="polite">
        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div
              key={i}
              className="ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {turn.text}
            </div>
          ) : (
            <div key={i} className="space-y-3 text-sm">
              {!turn.done && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> {liveStatus(turn)}
                </p>
              )}
              {turn.text && <Markdown text={turn.text} />}
              <DataUsed tools={turn.tools} />
              {turn.plan && (
                <PlanCard
                  plan={turn.plan}
                  conversationId={conversationId}
                  boughtBefore={boughtBefore}
                />
              )}
              {turn.error && (
                <p className="flex items-center gap-1.5 text-destructive">
                  <TriangleAlert className="size-4" /> {turn.error}
                </p>
              )}
            </div>
          ),
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <textarea
          aria-label="Ask the assistant"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="e.g. Put 150 USDC into the 3 best-performing large caps…"
          className="flex-1 resize-none rounded-lg border bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <div className="flex flex-col gap-1">
          <Button type="submit" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Ask
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              loaded.current = null;
              setConversationId(null);
              setBoughtBefore(false);
              setLoadError(null);
              setTurns([]);
              router.replace("/assistant", { scroll: false });
            }}
          >
            <SquarePen /> New
          </Button>
        </div>
      </form>
    </div>
  );
}

/** What the assistant is doing right now: its latest note, else the running tool call. */
function liveStatus(turn: Extract<Turn, { role: "assistant" }>): string {
  if (turn.progress) return turn.progress;
  const running = [...turn.tools].reverse().find((t) => t.ok === null);
  return running ? `${describeTool(running.name, running.input)}…` : "Thinking…";
}

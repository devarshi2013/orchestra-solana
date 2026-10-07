"use client";

import { Loader2, Send, ShieldAlert, SquarePen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fromTranscript, useAgentChat } from "@/hooks/use-agent-chat";
import { assistantApi } from "@/lib/api-client";

import { PlanCard } from "./plan-card";
import { SymphonyCard } from "./symphony-card";
import { AssistantTurnView, UserBubble } from "./turn";

const SUGGESTIONS = [
  "I have 200 USDC. Suggest a mix of large tech stocks and major crypto, ranked by market cap.",
  "Which crypto had the best 1Y return with liquidity above $5M? Plan 100 USDC across the top 3.",
  "Build a symphony that holds SOL while it's above its 50-day average and USDC otherwise, and backtest it.",
];

/**
 * The assistant chat: streamed replies, a "data used" panel per answer, plan
 * cards and symphony proposals. `?c=<id>` reopens a saved chat (from /history).
 */
export function AssistantChat() {
  const router = useRouter();
  const requested = useSearchParams().get("c");
  const [input, setInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [boughtBefore, setBoughtBefore] = useState(false);
  const loaded = useRef<string | null>(null);
  const onConversation = useCallback(
    (id: string) => {
      if (loaded.current === id) return;
      loaded.current = id;
      router.replace(`/assistant?c=${id}`, { scroll: false });
    },
    [router],
  );
  const {
    turns,
    busy,
    conversationId,
    send: sendMessage,
    reset,
    restore,
  } = useAgentChat({
    onConversation,
  });

  // Reopen a saved chat; skipped for the chat this page just started.
  useEffect(() => {
    if (!requested || requested === loaded.current) return;
    loaded.current = requested;
    let cancelled = false;
    assistantApi
      .conversation(requested)
      .then((saved) => {
        if (cancelled) return;
        setBoughtBefore(saved.executions > 0);
        setLoadError(null);
        restore(saved.id, fromTranscript(saved.turns));
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [requested, restore]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    void sendMessage(text);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
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
              onClick={() => send(s)}
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
            <UserBubble key={i} text={turn.text} />
          ) : (
            <AssistantTurnView
              key={i}
              turn={turn}
              cards={
                <>
                  {turn.symphonies.map((proposal) => (
                    <SymphonyCard key={proposal.id} proposal={proposal} />
                  ))}
                  {turn.plan && (
                    <PlanCard
                      plan={turn.plan}
                      conversationId={conversationId}
                      boughtBefore={boughtBefore}
                    />
                  )}
                </>
              }
            />
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
              send(input);
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
              reset();
              setBoughtBefore(false);
              setLoadError(null);
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

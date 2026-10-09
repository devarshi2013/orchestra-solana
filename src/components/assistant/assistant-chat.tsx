"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, Send, ShieldAlert, SquarePen } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAgentChat } from "@/hooks/use-agent-chat";

import { PlanCard } from "./plan-card";
import { StockBrowser } from "./stock-browser";
import { AssistantTurnView, UserBubble } from "./turn";

const SUGGESTIONS = [
  "I have 200 USDC. Suggest 3 large US tech stocks ranked by market cap, with live quotes.",
  "What are the biggest banks I can buy? Plan 100 USDC across the top 2.",
  "Show me energy ETFs and compare their price impact for a 50 USDC buy.",
];

/**
 * The stock assistant chat: streamed replies, a "data used" panel per answer,
 * and plan cards with live quotes and wallet-approved buys. The conversation
 * lives in this page only (no database); "New" starts over.
 */
export function AssistantChat() {
  const { publicKey } = useWallet();
  const [input, setInput] = useState("");
  const { turns, busy, send: sendMessage, reset } = useAgentChat(publicKey?.toBase58() ?? null);

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
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <Alert>
          <ShieldAlert />
          <AlertDescription>
            The assistant researches tokenized US stocks and proposes; it never trades on its own.
            Every figure comes from live data tools (open &ldquo;Data used&rdquo; to check them),
            and suggestions are limited to Orchestra&apos;s verified stock tokens. You approve every
            buy in your wallet. This is research, not financial advice.
          </AlertDescription>
        </Alert>

        {turns.length === 0 && (
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
                cards={turn.plan && <PlanCard plan={turn.plan} />}
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
            placeholder="e.g. Put 150 USDC into the 3 best-performing large-cap stocks…"
            className="flex-1 resize-none rounded-lg border bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <div className="flex flex-col gap-1">
            <Button type="submit" disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />} Ask
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={reset}>
              <SquarePen /> New
            </Button>
          </div>
        </form>
      </div>
      <StockBrowser onAsk={send} disabled={busy} />
    </div>
  );
}

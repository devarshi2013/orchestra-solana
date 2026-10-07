"use client";

import { ChevronDown, Loader2, Send, Sparkles, SquarePen } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { SignInGate } from "@/components/invest/sign-in-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useAssetRegistry } from "@/hooks/use-asset-registry";
import type { AgentContext } from "@/lib/assistant/schemas";
import { toTickerTree } from "@/lib/symphony/ticker-tree";
import type { Symphony } from "@/lib/symphony/types";

import { DisclosureGate } from "./disclosure-gate";
import { SymphonyDiff } from "./symphony-card";
import { AssistantTurnView, UserBubble } from "./turn";

const SUGGESTIONS = [
  "Explain what this symphony does and what drives its allocation.",
  "Suggest one improvement, and compare 1Y backtests of the current and suggested versions.",
  "What are the main risks of this strategy?",
];

/**
 * "Ask AI" about the symphony on screen: the assistant gets it as context
 * (with every message, so it sees the latest version), can explain and
 * backtest it, and suggests changes as a diff the user accepts or rejects.
 * Nothing changes without a click; `onAccept` decides what accepting does.
 */
export function AskAiPanel({
  current,
  context,
  onAccept,
  acceptLabel,
  acceptNote,
  description,
}: {
  current: Symphony;
  /** Built at send time, so it reflects the latest edits. */
  context: () => AgentContext;
  onAccept: (symphony: Symphony) => Promise<void>;
  acceptLabel?: string;
  acceptNote?: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          <Sparkles className="size-4 text-primary" />
          <CardTitle className="flex-1">Ask AI</CardTitle>
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {open && (
        <CardContent>
          <SignInGate>
            <DisclosureGate>
              <PanelChat
                current={current}
                context={context}
                onAccept={onAccept}
                acceptLabel={acceptLabel}
                acceptNote={acceptNote}
              />
            </DisclosureGate>
          </SignInGate>
        </CardContent>
      )}
    </Card>
  );
}

function PanelChat({
  current,
  context,
  onAccept,
  acceptLabel,
  acceptNote,
}: {
  current: Symphony;
  context: () => AgentContext;
  onAccept: (symphony: Symphony) => Promise<void>;
  acceptLabel?: string;
  acceptNote?: string;
}) {
  const [input, setInput] = useState("");
  const { turns, busy, send: sendMessage, reset } = useAgentChat();
  const { byMint } = useAssetRegistry();
  const currentTree = useMemo(
    () => toTickerTree(current, (mint) => byMint?.get(mint)?.symbol ?? null),
    [current, byMint],
  );

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    void sendMessage(text, context());
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  return (
    <div className="space-y-3">
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border px-3 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[36rem] space-y-3 overflow-y-auto" aria-live="polite">
        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <UserBubble key={i} text={turn.text} />
          ) : (
            <AssistantTurnView
              key={i}
              turn={turn}
              cards={turn.symphonies.map((proposal) => (
                <SymphonyDiff
                  key={proposal.id}
                  current={currentTree}
                  proposal={proposal}
                  onAccept={onAccept}
                  acceptLabel={acceptLabel}
                  acceptNote={acceptNote}
                />
              ))}
            />
          ),
        )}
      </div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <textarea
          aria-label="Ask about this symphony"
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
          placeholder="e.g. Would adding a 200-day trend filter have helped?"
          className="flex-1 resize-none rounded-lg border bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <div className="flex flex-col gap-1">
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Ask
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={reset}>
            <SquarePen /> New
          </Button>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        AI can be wrong; check the data each answer used. Not financial advice.
      </p>
    </div>
  );
}

"use client";

import { Loader2, Send, ShieldAlert, Sparkles, SquarePen, TriangleAlert } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AcceptedPlan } from "@/lib/agent/plan";
import { formatUsd } from "@/lib/backtest/format";

import { Markdown } from "./markdown";

type Turn =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      activity: string[];
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

/** A short description of a tool call for the activity list (never shows raw data). */
function describeTool(name: string, input: unknown): string {
  const i = (input ?? {}) as {
    tickers?: string[];
    ticker?: string;
    usdcAmount?: number;
    kind?: string;
  };
  switch (name) {
    case "listAssets":
      return `Looking up ${i.kind ? `${i.kind} ` : ""}assets`;
    case "getStockMetrics":
      return `Stock metrics: ${(i.tickers ?? []).join(", ")}`;
    case "getCryptoMetrics":
      return `Crypto metrics: ${(i.tickers ?? []).join(", ")}`;
    case "getSwapQuote":
      return `Quoting ${i.usdcAmount ?? "?"} USDC → ${i.ticker ?? "?"}`;
    case "getWalletBalances":
      return "Checking your wallet balance";
    case "submit_plan":
      return "Validating the plan";
    default:
      return name;
  }
}

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

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | null>(null);

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
      { role: "assistant", text: "", activity: [], progress: "", done: false },
    ]);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId: conversationId.current ?? undefined }),
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
          case "conversation":
            conversationId.current = event.id as string;
            break;
          case "text":
            updateLast((t) => ({ text: t.text + (event.delta as string), progress: "" }));
            break;
          case "progress":
            updateLast(() => ({ progress: event.text as string }));
            break;
          case "tool":
            updateLast((t) => ({
              activity: [...t.activity, describeTool(event.name as string, event.input)],
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
          The assistant researches and proposes; it never trades. Every figure comes from live data
          tools, and suggestions are limited to Orchestra&apos;s verified assets. This is research,
          not financial advice.
        </AlertDescription>
      </Alert>

      {turns.length === 0 && (
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
              {turn.activity.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {turn.activity.map((a, j) => (
                    <li key={j} className="flex items-center gap-1.5">
                      <Sparkles className="size-3" /> {a}
                    </li>
                  ))}
                </ul>
              )}
              {!turn.done && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> {turn.progress || "Thinking…"}
                </p>
              )}
              {turn.text && <Markdown text={turn.text} />}
              {turn.plan && <PlanCard plan={turn.plan} />}
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
              conversationId.current = null;
              setTurns([]);
            }}
          >
            <SquarePen /> New
          </Button>
        </div>
      </form>
    </div>
  );
}

function PlanCard({ plan }: { plan: AcceptedPlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposed plan · {formatUsd(plan.totalUsdc)}</CardTitle>
        <CardDescription>Ranking: {plan.rankingMethod}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Asset</th>
              <th className="py-1 text-right font-medium">USDC</th>
              <th className="py-1 pl-4 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {plan.items.map((item) => (
              <tr key={item.symbol} className="border-t align-top">
                <td className="py-1.5">
                  <span className="font-medium">{item.symbol}</span>{" "}
                  <Badge variant="outline" className="ml-1">
                    {item.kind}
                  </Badge>
                  <div className="text-xs text-muted-foreground">{item.name}</div>
                </td>
                <td className="py-1.5 text-right tabular-nums">{formatUsd(item.usdcAmount)}</td>
                <td className="py-1.5 pl-4 text-muted-foreground">{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          Checked against your wallet&apos;s USDC and the minimum order size. Nothing has been
          traded: review and sign any trades yourself in Swap or Invest. This is research, not
          financial advice.
        </p>
      </CardContent>
    </Card>
  );
}

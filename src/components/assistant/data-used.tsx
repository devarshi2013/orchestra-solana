"use client";

import { CheckCircle2, ChevronRight, Database, Loader2, XCircle } from "lucide-react";

import type { ToolCallView } from "@/lib/assistant/views";

/** A short description of a tool call (never shows raw data). */
export function describeTool(name: string, input: unknown): string {
  const i = (input ?? {}) as {
    tickers?: string[];
    ticker?: string;
    usdcAmount?: number;
    kind?: string;
  };
  switch (name) {
    case "listAssets":
      return `Looked up ${i.kind ? `${i.kind} ` : ""}assets`;
    case "getStockMetrics":
      return `Stock metrics: ${(i.tickers ?? []).join(", ")}`;
    case "getCryptoMetrics":
      return `Crypto metrics: ${(i.tickers ?? []).join(", ")}`;
    case "getSwapQuote":
      return `Jupiter quote: ${i.usdcAmount ?? "?"} USDC → ${i.ticker ?? "?"}`;
    case "getWalletBalances":
      return "Your wallet balance";
    case "submit_plan":
      return "Plan validation";
    default:
      return name;
  }
}

/** Pretty-prints JSON tool output; anything else is shown as is. */
function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/**
 * The "data used" panel under an answer: every tool call the assistant made,
 * with its exact input and the result it received, so figures can be checked
 * against their source.
 */
export function DataUsed({ tools }: { tools: readonly ToolCallView[] }) {
  if (tools.length === 0) return null;
  const failed = tools.filter((t) => t.ok === false).length;
  return (
    <details className="group rounded-lg border text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-muted-foreground select-none hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        <Database className="size-3.5" />
        Data used · {tools.length} tool {tools.length === 1 ? "call" : "calls"}
        {failed > 0 && <span className="text-destructive">({failed} returned an error)</span>}
      </summary>
      <ul className="divide-y border-t">
        {tools.map((tool) => (
          <li key={tool.id}>
            <details className="group/call">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-1.5 select-none hover:bg-muted/50">
                <ChevronRight className="size-3 text-muted-foreground transition-transform group-open/call:rotate-90" />
                {tool.ok === null ? (
                  <Loader2
                    className="size-3 animate-spin text-muted-foreground"
                    aria-label="Running"
                  />
                ) : tool.ok ? (
                  <CheckCircle2 className="size-3 text-emerald-600" aria-label="Succeeded" />
                ) : (
                  <XCircle className="size-3 text-destructive" aria-label="Error" />
                )}
                <span>{describeTool(tool.name, tool.input)}</span>
                <code className="ml-auto text-[0.7rem] text-muted-foreground">{tool.name}</code>
              </summary>
              <div className="space-y-2 px-3 pb-3">
                <div>
                  <p className="mb-1 font-medium text-muted-foreground">Input</p>
                  <pre className="max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(tool.input ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-medium text-muted-foreground">Result</p>
                  <pre className="max-h-72 overflow-auto rounded bg-muted p-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap">
                    {tool.result === null ? "Waiting for the result…" : pretty(tool.result)}
                  </pre>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </details>
  );
}

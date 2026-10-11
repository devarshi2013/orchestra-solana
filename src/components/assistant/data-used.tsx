"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useId, useState } from "react";

import type { ToolCallView } from "@/lib/assistant/views";
import { cn } from "@/lib/utils";

/** A short description of a tool call (never shows raw data). */
export function describeTool(name: string, input: unknown): string {
  const i = (input ?? {}) as {
    tickers?: string[];
    sector?: string;
    industry?: string;
    type?: string;
    search?: string;
    ticker?: string;
    usdcAmount?: number;
  };
  switch (name) {
    case "listStocks": {
      const filters = [i.sector, i.industry, i.type === "etf" ? "ETFs" : i.type, i.search]
        .filter(Boolean)
        .join(" · ");
      return `Browsed stocks: ${filters || "all sectors"}`;
    }
    case "getStockMetrics":
      return `Stock metrics: ${(i.tickers ?? []).join(", ")}`;
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

type ToolInput = {
  tickers?: string[];
  sector?: string;
  industry?: string;
  type?: string;
  search?: string;
  ticker?: string;
  usdcAmount?: number;
};

/** The same call as a step in progress, for the research trail: "Getting a Jupiter quote: 10 USDC → NVDA". */
export function trailLabel(name: string, input: unknown): string {
  const i = (input ?? {}) as ToolInput;
  switch (name) {
    case "listStocks": {
      const filters = [i.sector, i.industry, i.type === "etf" ? "ETFs" : i.type, i.search]
        .filter(Boolean)
        .join(" · ");
      return `Browsing the stock registry${filters ? `: ${filters}` : ""}`;
    }
    case "getStockMetrics":
      return `Fetching market data: ${(i.tickers ?? []).join(", ")}`;
    case "getSwapQuote":
      return `Getting a Jupiter quote: ${i.usdcAmount ?? "?"} USDC → ${i.ticker ?? "?"}`;
    case "getWalletBalances":
      return "Checking your wallet balance";
    case "submit_plan":
      return "Checking the plan";
    default:
      return `Running ${name}`;
  }
}

const SOURCES: Record<string, string> = {
  listStocks: "stock registry",
  getStockMetrics: "market data",
  getSwapQuote: "Jupiter",
  getWalletBalances: "your wallet",
};

/** Where a note's figures came from, from the tool calls that succeeded ("Jupiter", "market data"…). */
export function sourcesOf(tools: readonly ToolCallView[]): string[] {
  const names = tools.flatMap((t) => (t.ok && SOURCES[t.name] ? [SOURCES[t.name]!] : []));
  // Jupiter first, then the rest in the order they were used.
  return [...new Set(names)].sort((a, b) => Number(b === "Jupiter") - Number(a === "Jupiter"));
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
 * "Data used" at the top of a research note: one chip per tool call the
 * assistant made. A chip opens that call's exact input and the result it
 * received, so every figure can be checked against its source.
 */
export function DataUsed({ tools }: { tools: readonly ToolCallView[] }) {
  const panelId = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  if (tools.length === 0) return null;
  const open = tools.find((t) => t.id === openId) ?? null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          Data used
        </span>
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            aria-expanded={tool.id === openId}
            aria-controls={panelId}
            onClick={() => setOpenId((id) => (id === tool.id ? null : tool.id))}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tool.id === openId
                ? "border-label-blue/60 bg-glow-blue/15 text-foreground"
                : "text-muted-foreground hover:border-label-blue/40 hover:bg-glow-blue/10 hover:text-foreground",
            )}
          >
            {tool.ok === null ? (
              <Loader2 className="size-3 shrink-0 animate-spin" aria-label="Running" />
            ) : tool.ok ? (
              <CheckCircle2 className="size-3 shrink-0 text-success" aria-label="Succeeded" />
            ) : (
              <XCircle className="size-3 shrink-0 text-danger" aria-label="Error" />
            )}
            <span className="truncate">{describeTool(tool.name, tool.input)}</span>
          </button>
        ))}
      </div>
      {open && (
        <div id={panelId} className="space-y-2 rounded-xl border bg-card p-3 text-xs">
          <p className="flex items-center justify-between gap-3 text-muted-foreground">
            <span>{describeTool(open.name, open.input)}</span>
            <code className="font-mono text-[0.7rem]">{open.name}</code>
          </p>
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Input</p>
            <pre className="max-h-40 overflow-auto rounded-lg bg-surface-raised p-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap">
              {JSON.stringify(open.input ?? {}, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Result</p>
            <pre className="max-h-72 overflow-auto rounded-lg bg-surface-raised p-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap">
              {open.result === null ? "Waiting for the result…" : pretty(open.result)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

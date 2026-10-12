"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useId, useState } from "react";

import type { ToolCallView } from "@/lib/assistant/views";
import { cn } from "@/lib/utils";

type ToolInput = {
  query?: string;
  tickers?: string[];
  symbol?: string;
  usdcAmount?: number;
};

const tickersOf = (i: ToolInput) => (i.tickers ?? []).join(", ");
const quoteOf = (i: ToolInput) => `${i.usdcAmount ?? "?"} USDC → ${i.symbol ?? "?"}`;

type Label = (i: ToolInput) => string;
type Labels = { chip: Label; trail: Label; source?: string };
/**
 * Per tool: its chip (a short description that never shows raw data), the
 * same call as a step in progress for the research trail, and the source its
 * figures are credited to.
 */
const LABELS: Record<string, Labels> = {
  searchStocks: {
    source: "Jupiter",
    chip: (i) => `Searched stocks: “${i.query ?? ""}”`,
    trail: (i) => `Searching Jupiter's stocks for “${i.query ?? ""}”`,
  },
  getStockMetrics: {
    source: "market data",
    chip: (i) => `Stock metrics: ${tickersOf(i)}`,
    trail: (i) => `Fetching market data: ${tickersOf(i)}`,
  },
  getSwapQuote: {
    source: "Jupiter",
    chip: (i) => `Jupiter quote: ${quoteOf(i)}`,
    trail: (i) => `Getting a Jupiter quote: ${quoteOf(i)}`,
  },
  getWalletBalances: {
    source: "your wallet",
    chip: () => "Your wallet balance",
    trail: () => "Checking your wallet balance",
  },
  submit_plan: { chip: () => "Plan validation", trail: () => "Checking the plan" },
  propose_strategy: {
    chip: (i) => `Strategy check: ${i.symbol ?? ""}`,
    trail: () => "Checking the strategy",
  },
};

const labelsOf = (name: string): Labels =>
  (Object.hasOwn(LABELS, name) && LABELS[name]) || {
    chip: () => name,
    trail: () => `Running ${name}`,
  };

const describeTool = (name: string, input: unknown) =>
  labelsOf(name).chip((input ?? {}) as ToolInput);

/** The same call as a step in progress, for the research trail: "Getting a Jupiter quote: 10 USDC → NVDA". */
export function trailLabel(name: string, input: unknown): string {
  return labelsOf(name).trail((input ?? {}) as ToolInput);
}

/** Where a note's figures came from, from the tool calls that succeeded ("Jupiter", "market data"…). */
export function sourcesOf(tools: readonly ToolCallView[]): string[] {
  const names = tools.flatMap((t) => (t.ok && labelsOf(t.name).source) || []);
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
 * The tool calls behind a reply, collapsed into one muted line ("3 sources").
 * Opened, each call is a row; a row shows that call's exact input and result.
 */
export function DataUsed({ tools }: { tools: readonly ToolCallView[] }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  if (tools.length === 0) return null;
  const failed = tools.filter((t) => t.ok === false).length;
  return (
    <div className="text-[13px] tracking-[-0.01em]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex cursor-pointer items-center gap-1 rounded text-ink-muted transition-colors outline-none hover:text-text-extra-high focus-visible:ring-2 focus-visible:ring-gray-1200"
      >
        {tools.length} {tools.length === 1 ? "source" : "sources"}
        {failed > 0 && <span className="text-status-error-text">· {failed} failed</span>}
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul id={listId} className="mt-2 space-y-px">
          {tools.map((tool) => {
            const expanded = tool.id === openId;
            return (
              <li key={tool.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenId(expanded ? null : tool.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left transition-colors outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-gray-1200",
                    expanded ? "bg-soft text-text-extra-high" : "text-text-high",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {describeTool(tool.name, tool.input)}
                  </span>
                  {tool.ok === null && (
                    <Loader2 className="size-3 shrink-0 animate-spin" aria-label="Running" />
                  )}
                  {tool.ok === false && (
                    <span className="shrink-0 text-[12px] text-status-error-text">Failed</span>
                  )}
                </button>
                {expanded && (
                  <div className="mt-1 mb-2 space-y-1.5 pl-2.5">
                    <pre className="max-h-40 overflow-auto rounded-[10px] bg-soft p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-text-high">
                      {JSON.stringify(tool.input ?? {}, null, 2)}
                    </pre>
                    <pre className="max-h-72 overflow-auto rounded-[10px] bg-soft p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-text-high">
                      {tool.result === null ? "…" : pretty(tool.result)}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

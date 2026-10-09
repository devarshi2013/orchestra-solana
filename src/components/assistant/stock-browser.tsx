"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantApi, type StockCompany } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { LiquidityBadge } from "./liquidity-badge";

type TypeFilter = "all" | "stock" | "etf";

const chip = (active: boolean) =>
  cn(
    "shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-[background-color,color,transform] active:scale-95",
    active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
  );

/**
 * "Browse stocks": every company in the stock registry, filterable by sector,
 * type and search, with each one's liquidity tier. Clicking one asks the
 * assistant about it.
 */
export function StockBrowser({
  onAsk,
  disabled,
}: {
  onAsk: (text: string) => void;
  disabled: boolean;
}) {
  const [data, setData] = useState<{ sectors: string[]; companies: StockCompany[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState<string | null>(null);
  const [type, setType] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    assistantApi
      .stocks(controller.signal)
      .then(setData)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.companies ?? []).filter(
      (c) =>
        (!sector || c.sector === sector) &&
        (type === "all" || c.type === type) &&
        (!q ||
          c.ticker.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          (c.industry ?? "").toLowerCase().includes(q) ||
          c.issuers.some((i) => i.symbol.toLowerCase().includes(q))),
    );
  }, [data, sector, type, search]);

  return (
    <section
      aria-label="Browse stocks"
      className="flex h-full max-h-full flex-col gap-3 rounded-xl border p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Browse stocks</h2>
        {data && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {shown.length} of {data.companies.length}
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search stocks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ticker, company or industry"
          className="h-8 pl-7 text-sm"
        />
      </div>

      <div className="flex gap-1.5" role="group" aria-label="Type">
        {(["all", "stock", "etf"] as const).map((t) => (
          <button
            key={t}
            className={chip(type === t)}
            aria-pressed={type === t}
            onClick={() => setType(t)}
          >
            {t === "all" ? "All" : t === "stock" ? "Stocks" : "ETFs"}
          </button>
        ))}
      </div>

      {data && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sector">
          <button
            className={chip(sector === null)}
            aria-pressed={sector === null}
            onClick={() => setSector(null)}
          >
            All sectors
          </button>
          {data.sectors.map((s) => (
            <button
              key={s}
              className={chip(sector === s)}
              aria-pressed={sector === s}
              onClick={() => setSector(sector === s ? null : s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="-mx-1 min-h-40 flex-1 overflow-y-auto">
        {error ? (
          <p className="px-1 text-xs text-destructive">Couldn&apos;t load stocks: {error}</p>
        ) : !data ? (
          <ul className="space-y-1 px-1.5" role="status" aria-label="Loading stocks">
            {Array.from({ length: 7 }, (_, i) => (
              <li key={i} className="flex items-start gap-2 py-1.5">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-14" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </li>
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No stocks match these filters.</p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((c) => (
              <li key={c.ticker}>
                <button
                  disabled={disabled}
                  onClick={() => onAsk(`Tell me about ${c.ticker}`)}
                  title={`Ask the assistant about ${c.ticker}`}
                  className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-[background-color,transform] hover:bg-muted active:scale-[0.99] active:bg-muted disabled:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{c.ticker}</span>
                      {c.type === "etf" && (
                        <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground uppercase">
                          ETF
                        </span>
                      )}
                      {c.preIpo && (
                        <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                          Pre-IPO
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.companyName}
                      {c.industry ? ` · ${c.industry}` : ""}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground/80">
                      {c.issuers.map((i) => i.symbol).join(" · ")}
                    </p>
                  </div>
                  <LiquidityBadge tier={c.liquidityTier} className="mt-0.5 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Liquidity from a 100 USDC test quote. Click a stock to ask the assistant.
      </p>
    </section>
  );
}

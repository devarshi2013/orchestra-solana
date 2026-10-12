"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Change } from "@/components/market/change";
import { formatPrice } from "@/components/market/format";
import { TokenLogo } from "@/components/market/token-logo";
import { Skeleton } from "@/components/ui/skeleton";
import type { Comparison, ComparisonRow } from "@/lib/markdown/comparison";
import { formatCompactUsd } from "@/lib/market/series";
import type { StockResponse } from "@/lib/stocks/api";
import type { StockToken } from "@/lib/stocks/types";
import { cn } from "@/lib/utils";

/** A ticker's live figures: its most liquid token, or why there are none. */
type Live = { token: StockToken } | { missing: string };

/**
 * Each ticker's most liquid token, live from Jupiter (GET /api/stocks/[ticker]).
 * One request per ticker, once; a failed one says so in its row.
 */
function useLiveTokens(tickers: string[]) {
  const key = tickers.join(",");
  const [live, setLive] = useState<Record<string, Live> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (ticker: string): Promise<[string, Live]> => {
      try {
        const response = await fetch(`/api/stocks/${encodeURIComponent(ticker)}`, {
          signal: controller.signal,
        });
        if (response.status === 404) return [ticker, { missing: "Not a listed stock" }];
        if (!response.ok) return [ticker, { missing: "Live price unavailable right now" }];
        const { stock } = (await response.json()) as StockResponse;
        const token = stock.tokens[0];
        return [ticker, token ? { token } : { missing: "No token listed" }];
      } catch {
        return [ticker, { missing: "Live price unavailable right now" }];
      }
    };
    void Promise.all(key.split(",").filter(Boolean).map(load)).then((entries) => {
      if (!controller.signal.aborted) setLive(Object.fromEntries(entries));
    });
    return () => controller.abort();
  }, [key]);

  return live;
}

/** The sortable columns. Text columns sort A→Z first; numeric ones high→low, then off. */
const COLUMNS = [
  { key: "company", label: "Company", numeric: false },
  { key: "price", label: "Price", numeric: true },
  { key: "change24h", label: "1D", numeric: true },
  { key: "marketCap", label: "Market cap", numeric: true },
  { key: "return1y", label: "1Y return", numeric: true },
  { key: "pe", label: "P/E", numeric: true },
] as const;
type SortKey = (typeof COLUMNS)[number]["key"];
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

const formatReturn = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const NUMBER_CELL = "py-2 pl-4 text-right whitespace-nowrap";

/**
 * A stock comparison the assistant sent as a ```comparison block: company and
 * ticker, Jupiter's live price and 1D change for its most liquid token, then
 * market cap, 1Y return and P/E from the assistant's market data. Click a
 * header to sort.
 */
export function ComparisonTable({ comparison }: { comparison: Comparison }) {
  const tickers = useMemo(
    () => [...new Set(comparison.rows.map((r) => r.ticker))],
    [comparison.rows],
  );
  const live = useLiveTokens(tickers);
  const [sort, setSort] = useState<Sort>(null);

  const tokenOf = (ticker: string) => {
    const entry = live?.[ticker];
    return entry && "token" in entry ? entry.token : null;
  };

  const rows = useMemo(() => {
    if (!sort) return comparison.rows;
    const value = (row: ComparisonRow, key: SortKey): string | number | null => {
      if (key === "price" || key === "change24h") {
        const entry = live?.[row.ticker];
        return entry && "token" in entry ? entry.token[key] : null;
      }
      return row[key];
    };
    return [...comparison.rows].sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      if (va === null) return vb === null ? 0 : 1; // missing values last either way
      if (vb === null) return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [comparison.rows, sort, live]);

  const toggle = (key: SortKey, numeric: boolean) =>
    setSort((s) =>
      s?.key !== key
        ? { key, dir: numeric ? "desc" : "asc" }
        : s.dir === "desc"
          ? { key, dir: "asc" }
          : numeric
            ? null
            : { key, dir: "desc" },
    );

  const header = ({ key, label, numeric }: (typeof COLUMNS)[number]) => {
    const active = sort?.key === key;
    const Icon = sort?.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <th
        key={key}
        scope="col"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn(
          "py-2 text-[12.5px] font-medium whitespace-nowrap text-ink-muted",
          numeric ? "pl-4 text-right" : "text-left",
        )}
      >
        <button
          type="button"
          onClick={() => toggle(key, numeric)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-0.5 rounded transition-colors duration-150 hover:text-text-extra-high",
            active && "text-text-extra-high",
            numeric && "flex-row-reverse",
          )}
        >
          {label}
          {active && <Icon className="size-3.5" aria-hidden />}
        </button>
      </th>
    );
  };

  const loading = live === null;
  return (
    <figure className="space-y-1.5">
      {comparison.title && (
        <figcaption className="text-[15px] font-semibold text-text-extra-high">
          {comparison.title}
        </figcaption>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px] text-text-extra-high tabular-nums">
          <thead className="border-b border-soft-strong">
            <tr>{COLUMNS.map(header)}</tr>
          </thead>
          <tbody className="divide-y divide-soft">
            {rows.map((row) => {
              const token = tokenOf(row.ticker);
              const entry = live?.[row.ticker];
              const note = entry && "missing" in entry ? entry.missing : undefined;
              return (
                <tr key={row.ticker}>
                  <td className="py-2">
                    <span className="flex min-w-36 items-center gap-2">
                      <TokenLogo src={token?.icon} symbol={row.ticker} className="size-5" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.company}</span>
                        <span className="block text-[12px] text-ink-muted">
                          {row.ticker}
                          {token && ` · ${token.symbol}`}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={NUMBER_CELL}>
                    {loading ? (
                      <Skeleton className="ml-auto h-3.5 w-14" />
                    ) : token?.price != null ? (
                      formatPrice(token.price)
                    ) : (
                      <Missing title={note} />
                    )}
                  </td>
                  <td className={NUMBER_CELL}>
                    {loading ? (
                      <Skeleton className="ml-auto h-3.5 w-12" />
                    ) : (
                      <Change pct={token?.change24h} className="justify-end" />
                    )}
                  </td>
                  <td className={NUMBER_CELL}>
                    {row.marketCap !== null ? formatCompactUsd(row.marketCap) : <Missing />}
                  </td>
                  <td
                    className={cn(
                      NUMBER_CELL,
                      row.return1y !== null && row.return1y > 0 && "text-green-800",
                      row.return1y !== null && row.return1y < 0 && "text-red-800",
                    )}
                  >
                    {row.return1y !== null ? formatReturn(row.return1y) : <Missing />}
                  </td>
                  <td className={NUMBER_CELL}>
                    {row.pe !== null ? row.pe.toFixed(1) : <Missing />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Missing({ title = "Not available" }: { title?: string }) {
  return (
    <span className="text-ink-muted" title={title}>
      —
    </span>
  );
}

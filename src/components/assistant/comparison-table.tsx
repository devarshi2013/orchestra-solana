"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TokenLogo } from "@/components/market/token-logo";
import { Skeleton } from "@/components/ui/skeleton";
import type { Comparison, ComparisonRow } from "@/lib/markdown/comparison";
import { formatCompactUsd, formatPrice, type Point } from "@/lib/market/series";
import { cn } from "@/lib/utils";

type LiveRow = {
  symbol: string;
  icon: string | null;
  price: number | null;
  priceNote: string | null;
  change24h: number | null;
  sparkline: Point[] | null;
};
type LiveData = { rows: Record<string, LiveRow>; pending: string[]; unknown: string[] };

const RETRY_MS = 4_000;
const MAX_RETRIES = 8;

/** Live price, logo and sparkline per ticker; asks again while sparklines load. */
function useLiveRows(tickers: string[]) {
  const key = tickers.join(",");
  const [data, setData] = useState<LiveData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async (attempt: number) => {
      try {
        const response = await fetch(`/api/market/compare?tickers=${encodeURIComponent(key)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as LiveData;
        setData(next);
        if (next.pending.length > 0 && attempt < MAX_RETRIES) {
          timer = setTimeout(() => void load(attempt + 1), RETRY_MS);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void load(0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key]);

  return { data, failed };
}

type SortKey = "company" | "ticker" | "price" | "marketCap" | "return1y" | "pe";
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

const formatReturn = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const formatPe = (v: number) => v.toFixed(1);

/**
 * A stock comparison the assistant sent as a ```comparison block: company
 * with logo, ticker, Jupiter's live price, market cap, 1Y return, P/E and a
 * 7-day sparkline. Click a column header to sort.
 */
export function ComparisonTable({ comparison }: { comparison: Comparison }) {
  const tickers = useMemo(
    () => [...new Set(comparison.rows.map((r) => r.ticker))],
    [comparison.rows],
  );
  const { data, failed } = useLiveRows(tickers);
  const [sort, setSort] = useState<Sort>(null);

  const rows = useMemo(() => {
    if (!sort) return comparison.rows;
    const value = (row: ComparisonRow, key: SortKey): string | number | null =>
      key === "price" ? (data?.rows[row.ticker]?.price ?? null) : row[key];
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
  }, [comparison.rows, sort, data]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s?.key !== key
        ? { key, dir: key === "company" || key === "ticker" ? "asc" : "desc" }
        : s.dir === "desc"
          ? { key, dir: "asc" }
          : s.key === "company" || s.key === "ticker"
            ? { key, dir: "desc" }
            : null,
    );

  const header = (key: SortKey, label: string, numeric = false) => {
    const active = sort?.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn("px-3 py-2 font-medium whitespace-nowrap", numeric && "text-right")}
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          className={cn(
            "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
            active && "text-foreground",
            numeric && "flex-row-reverse",
          )}
        >
          {label}
          <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <figure className="space-y-2">
      {comparison.title && (
        <figcaption className="text-xs font-medium text-muted-foreground">
          {comparison.title}
        </figcaption>
      )}
      <div className="max-h-[28rem] overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-xs tabular-nums sm:text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-left text-muted-foreground">
            <tr>
              {header("company", "Company")}
              {header("ticker", "Ticker")}
              {header("price", "Price", true)}
              {header("marketCap", "Market cap", true)}
              {header("return1y", "1Y return", true)}
              {header("pe", "P/E", true)}
              <th scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
                7D
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-border [&>tr]:transition-colors [&>tr:hover]:bg-muted/60 [&>tr:nth-child(even)]:bg-muted/30">
            {rows.map((row) => {
              const live = data?.rows[row.ticker];
              const loading = !data && !failed;
              return (
                <tr key={row.ticker}>
                  <td className="px-3 py-2">
                    <span className="flex min-w-36 items-center gap-2">
                      <TokenLogo src={live?.icon} symbol={row.ticker} className="size-5" />
                      <span className="truncate">{row.company}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{row.ticker}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                    {loading ? (
                      <Skeleton className="ml-auto h-3.5 w-14" />
                    ) : live?.price != null ? (
                      formatPrice(live.price)
                    ) : (
                      <Missing title={live?.priceNote ?? undefined} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                    {row.marketCap !== null ? formatCompactUsd(row.marketCap) : <Missing />}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono whitespace-nowrap",
                      row.return1y !== null && row.return1y > 0 && "text-success",
                      row.return1y !== null && row.return1y < 0 && "text-destructive",
                    )}
                  >
                    {row.return1y !== null ? formatReturn(row.return1y) : <Missing />}
                  </td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                    {row.pe !== null ? formatPe(row.pe) : <Missing />}
                  </td>
                  <td className="px-3 py-2">
                    <Sparkline
                      points={live?.sparkline ?? null}
                      loading={loading || (data?.pending.includes(row.ticker) ?? false)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Price: live from Jupiter for the most liquid token. 7D: price history from GeckoTerminal.
        {failed && " Live data is unavailable right now."}
      </p>
    </figure>
  );
}

function Missing({ title = "Not available" }: { title?: string }) {
  return (
    <span className="text-muted-foreground" title={title}>
      —
    </span>
  );
}

/** A tiny line of 7-day closes, green if it ended higher, red if lower. */
function Sparkline({ points, loading }: { points: Point[] | null; loading: boolean }) {
  if (!points || points.length < 2) {
    return loading ? (
      <Skeleton className="ml-auto h-5 w-16" />
    ) : (
      <span className="block text-right">
        <Missing />
      </span>
    );
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const first = points[0]!.time;
  const span = points.at(-1)!.time - first || 1;
  const W = 64;
  const H = 20;
  const d = points
    .map((p) => {
      const x = ((p.time - first) / span) * W;
      const y = max === min ? H / 2 : H - 1 - ((p.value - min) / (max - min)) * (H - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values.at(-1)! >= values[0]!;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("ml-auto h-5 w-16", up ? "text-success" : "text-destructive")}
      role="img"
      aria-label={`7-day price ${up ? "up" : "down"}`}
    >
      <polyline
        points={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

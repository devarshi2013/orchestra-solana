"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Change } from "@/components/market/change";
import {
  formatAgo,
  formatInteger,
  formatPrice,
  formatUsdCompact,
} from "@/components/market/format";
import { Sparkline } from "@/components/market/sparkline";
import {
  issuerLabel,
  newestToken,
  stockFigures,
  type StockFigures,
} from "@/components/market/stock-figures";
import { TokenLogo } from "@/components/market/token-logo";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useStocks } from "@/hooks/use-markets";
import { useNow } from "@/hooks/use-now";
import { ISSUERS, type IssuerId } from "@/lib/stocks/issuers";
import type { Stock } from "@/lib/stocks/types";
import { cn } from "@/lib/utils";

type Row = { stock: Stock; figures: StockFigures };

/** The tabs: everything, then each issuer present in the data ("other" for tokens we don't group). */
type Tab = "all" | IssuerId | "other";
const tabOf = (issuer: Stock["tokens"][number]["issuer"]): Tab => issuer ?? "other";
const tabLabel = (tab: Tab) =>
  tab === "all" ? "All" : tab === "other" ? "Other" : ISSUERS[tab].label;

const CARD =
  "rounded-[24px] border border-border-medium bg-white shadow-[0_8px_40px_rgba(0,0,0,0.03)]";
const SECTION = "mx-auto max-w-7xl px-4 md:px-6";

/** Every listed company, read live from Jupiter: three highlight cards, issuer tabs and the table. */
export function HomeStocks() {
  const { data, error, loading } = useStocks();
  const rows = useMemo(
    () => (data?.stocks ?? []).map((stock) => ({ stock, figures: stockFigures(stock) })),
    [data],
  );

  if (!data) {
    return error ? (
      <EmptyState title="Failed to load stocks" detail={error} />
    ) : (
      <HomeStocksSkeleton />
    );
  }
  return (
    <>
      {error && !loading && <StaleNotice asOf={data.asOf} error={error} />}
      <Highlights rows={rows} />
      <StockTabs rows={rows} />
    </>
  );
}

/** Shown when a refresh failed: the rows below are from the last good read, and say how old it is. */
function StaleNotice({ asOf, error }: { asOf: string; error: string }) {
  const now = useNow();
  return (
    <div className={SECTION}>
      <p
        role="status"
        className="rounded-2xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-[13px] text-status-warning-text"
      >
        Not updated since {now ? formatAgo(asOf, now) : "the last read"}: {error}
      </p>
    </div>
  );
}

/* --- Highlights --- */

type Highlight = { title: string; row: Row | undefined; metric: ReactNode };

function pickMax(rows: readonly Row[], value: (row: Row) => number | string | null) {
  let best: Row | undefined;
  let bestValue: number | string | null = null;
  for (const row of rows) {
    const v = value(row);
    if (v != null && (bestValue == null || v > bestValue)) [best, bestValue] = [row, v];
  }
  return best;
}

function Highlights({ rows }: { rows: readonly Row[] }) {
  const latest = pickMax(rows, ({ stock }) => newestToken(stock));
  const volume = pickMax(rows, ({ figures }) => figures.volume24h);
  const gainer = pickMax(rows, ({ figures }) => figures.change24h);
  const cards: Highlight[] = [
    { title: "Latest added", row: latest, metric: formatPrice(latest?.figures.price) },
    {
      title: "Highest volume (24H)",
      row: volume,
      metric: formatUsdCompact(volume?.figures.volume24h),
    },
    {
      title: "Biggest gainer (24H)",
      row: gainer,
      metric: (
        <Change pct={gainer?.figures.change24h} tone="accent" className="gap-1 [&_svg]:size-2.5" />
      ),
    },
  ];
  return (
    <section className={cn(SECTION, "pb-10 md:pb-12")} aria-label="Highlights">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <HighlightCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}

function HighlightCard({ title, row, metric }: Highlight) {
  const body = (
    <article className="rounded-[22px] bg-border-light/30">
      <p className="p-3 py-[10px] pb-0 pl-[24px] text-[15px] text-text-high">{title}</p>
      <div className="mt-3 rounded-[22px] border border-border-medium bg-white p-[24px] transition-[box-shadow,transform] duration-150 ease-out hover:ring-2 hover:ring-border-medium/80 active:scale-[0.98] motion-reduce:transition-none">
        {row ? (
          <>
            <Sparkline mint={row.stock.tokens[0]!.mint} className="h-32 w-full" />
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <TokenLogo
                  src={row.stock.icon}
                  symbol={row.stock.ticker}
                  className="size-6.5 ring-2 ring-border-light"
                />
                <span className="truncate text-[22px] leading-none text-text-extra-high">
                  {row.stock.name}
                </span>
              </div>
              <span className="shrink-0 text-[18px] leading-none font-medium text-text-extra-high tabular-nums">
                {metric}
              </span>
            </div>
          </>
        ) : (
          <p className="flex h-[158px] items-center justify-center text-[14px] text-text-low">
            No data
          </p>
        )}
      </div>
    </article>
  );
  return row ? (
    <Link
      href={`/stocks/${encodeURIComponent(row.stock.ticker)}`}
      aria-label={`${title}: ${row.stock.name}`}
      className="block cursor-pointer rounded-[22px] focus-visible:ring-2 focus-visible:ring-border-medium focus-visible:outline-none"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

/** Loading placeholders for the highlights and the table. */
export function HomeStocksSkeleton() {
  return (
    <>
      <HighlightsSkeleton />
      <TableSkeleton />
    </>
  );
}

function HighlightsSkeleton() {
  return (
    <section className={cn(SECTION, "pb-10 md:pb-12")} aria-busy>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-[22px] bg-border-light/30 p-3">
            <Skeleton className="ml-3 h-4 w-32" />
            <div className="mt-3 rounded-[22px] border border-border-medium bg-white p-[24px]">
              <Skeleton className="h-32 w-full rounded-xl bg-gray-50" />
              <div className="mt-2 flex items-center gap-2.5">
                <Skeleton className="size-6.5 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- Tabs + table --- */

function StockTabs({ rows }: { rows: readonly Row[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabs = useMemo(() => {
    const present = new Set<Tab>();
    for (const { stock } of rows) for (const t of stock.tokens) present.add(tabOf(t.issuer));
    // Issuers in ISSUERS order, then "other".
    const ordered = [...(Object.keys(ISSUERS) as IssuerId[]), "other" as const].filter((t) =>
      present.has(t),
    );
    return ["all" as const, ...ordered];
  }, [rows]);

  const requested = params.get("issuer") as Tab | null;
  const tab: Tab = requested && tabs.includes(requested) ? requested : "all";
  const setTab = (next: Tab) => {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete("issuer");
    else query.set("issuer", next);
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const shown = useMemo(
    () =>
      tab === "all"
        ? rows
        : rows.filter(({ stock }) => stock.tokens.some((t) => tabOf(t.issuer) === tab)),
    [rows, tab],
  );

  return (
    <div>
      <div className={SECTION}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="-mb-2 scrollbar-hide min-w-0 flex-1 overflow-x-auto pb-2">
            <SegmentedControl
              aria-label="Stocks by issuer"
              className="w-max min-w-0 bg-transparent [&_[data-slot=segmented-control-pill]]:bg-black/[0.04]! [&_[data-slot=segmented-control-pill]]:shadow-none! [&>button]:text-[22px]!"
              items={tabs.map((t) => ({ value: t, label: tabLabel(t) }))}
              value={tab}
              onValueChange={setTab}
            />
          </div>
        </div>
      </div>
      {shown.length === 0 ? <EmptyState title="No stocks" /> : <StockTable rows={shown} />}
    </div>
  );
}

type SortKey = "price" | "change24h" | "volume24h" | "liquidity" | "holders";
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

/** The numeric columns, in order; `null` figures sort last either way. */
const COLUMNS: {
  key: SortKey;
  label: string;
  width: string;
  cell: (f: StockFigures) => ReactNode;
}[] = [
  { key: "price", label: "Price", width: "130px", cell: (f) => formatPrice(f.price) },
  {
    key: "change24h",
    label: "1D",
    width: "100px",
    cell: (f) => (
      <Change pct={f.change24h} className="w-full justify-end text-[14px] font-medium" />
    ),
  },
  {
    key: "volume24h",
    label: "24h Volume",
    width: "150px",
    cell: (f) => formatUsdCompact(f.volume24h),
  },
  {
    key: "liquidity",
    label: "Liquidity",
    width: "140px",
    cell: (f) => formatUsdCompact(f.liquidity),
  },
  { key: "holders", label: "Holders", width: "120px", cell: (f) => formatInteger(f.holders) },
];

const ROW_HEIGHT = 64;
const NEXT_DIR = { desc: "asc", asc: null } as const;

function sortRows(rows: readonly Row[], sort: Sort): readonly Row[] {
  if (!sort) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [x, y] = [a.figures[sort.key], b.figures[sort.key]];
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    return (x - y) * sign;
  });
}

function StockTable({ rows }: { rows: readonly Row[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<Sort>(null);
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const listRef = useRef<HTMLTableSectionElement>(null);
  const [offset, setOffset] = useState(0);
  // The rows' distance from the top of the page (offsetTop is only relative to the card), kept
  // current as content above the table (highlights, tabs) loads or the window resizes.
  useLayoutEffect(() => {
    const measure = () => {
      const top = listRef.current?.getBoundingClientRect().top;
      if (top !== undefined) setOffset(top + window.scrollY);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);
  const virtualizer = useWindowVirtualizer({
    count: sorted.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: offset,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0]!.start - virtualizer.options.scrollMargin : 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items.at(-1)!.end : 0;

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s?.key !== key
        ? { key, dir: "desc" }
        : s.dir === "desc"
          ? { key, dir: "asc" }
          : NEXT_DIR[s.dir],
    );
  const open = (stock: Stock) => router.push(`/stocks/${encodeURIComponent(stock.ticker)}`);

  return (
    <section className={cn(SECTION, "pb-12 md:pb-24")}>
      <div className={cn(CARD, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: 52 }} />
              <col style={{ width: "34%" }} />
              {COLUMNS.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border-extra-light bg-gray-50/80">
                <th className="border-b border-border-light bg-gray-50/80 py-3 pr-1 pl-3 text-right text-[12px] font-medium text-text-high md:pl-5 md:text-[14px]">
                  #
                </th>
                <th className="border-b border-border-light bg-gray-50/80 py-3 pr-2 pl-3 text-left text-[12px] font-medium text-text-high md:pr-4 md:pl-4 md:text-[14px]">
                  Name
                </th>
                {COLUMNS.map((c, i) => {
                  const dir = sort?.key === c.key ? sort.dir : null;
                  const Icon =
                    dir === "asc" ? ChevronUp : dir === "desc" ? ChevronDown : ChevronsUpDown;
                  return (
                    <th
                      key={c.key}
                      aria-sort={
                        dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"
                      }
                      className={cn(
                        "border-b border-border-light bg-gray-50/80 py-3 text-right text-[12px] font-medium text-text-high md:text-[14px]",
                        i === COLUMNS.length - 1 ? "pr-4 pl-3 md:pr-8 md:pl-6" : "px-3 md:px-6",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className="inline-flex w-full min-w-0 cursor-pointer items-center justify-end gap-1 text-nowrap select-none hover:text-text-extra-high focus-visible:text-text-extra-high focus-visible:outline-none"
                      >
                        {c.label}
                        <Icon
                          className={cn("text-text-extra-low", dir ? "size-4" : "size-3.5")}
                          aria-hidden
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody ref={listRef} className="divide-y divide-border-extra-light">
              {padTop > 0 && (
                <tr aria-hidden>
                  <td
                    colSpan={COLUMNS.length + 2}
                    style={{ height: padTop, padding: 0, border: 0 }}
                  />
                </tr>
              )}
              {items.map((item) => {
                const { stock, figures } = sorted[item.index]!;
                return (
                  <tr
                    key={stock.ticker}
                    style={{ height: ROW_HEIGHT }}
                    tabIndex={0}
                    onClick={() => open(stock)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      open(stock);
                    }}
                    className="group cursor-pointer transition-colors hover:bg-gray-50/50 focus-visible:bg-gray-50 focus-visible:outline-none"
                  >
                    <td className="h-16 py-0 pr-1 pl-3 text-right align-middle text-[13px] font-medium text-text-low tabular-nums md:pl-5">
                      {item.index + 1}
                    </td>
                    <td className="h-16 py-0 pr-2 pl-3 text-left align-middle md:pr-4 md:pl-4">
                      <div className="flex items-center gap-[8px]">
                        <TokenLogo src={stock.icon} symbol={stock.ticker} className="size-[26px]" />
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/stocks/${encodeURIComponent(stock.ticker)}`}
                            onClick={(e) => e.stopPropagation()}
                            tabIndex={-1}
                            className="truncate text-[16px] font-medium text-text-extra-high"
                            title={stock.name}
                          >
                            {stock.name}
                          </Link>
                          <span className="shrink-0 text-[14px] font-medium text-text-extra-low">
                            ${stock.ticker}
                          </span>
                          <IssuerChips stock={stock} />
                        </div>
                      </div>
                    </td>
                    {COLUMNS.map((c, i) => (
                      <td
                        key={c.key}
                        className={cn(
                          "h-16 py-0 text-right align-middle text-[14px] font-medium text-[#2D2D2D] tabular-nums",
                          i === COLUMNS.length - 1 ? "pr-4 pl-3 md:pr-8 md:pl-6" : "px-3 md:px-6",
                          figures[c.key] == null && "text-text-extra-low",
                        )}
                      >
                        {c.cell(figures)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {padBottom > 0 && (
                <tr aria-hidden>
                  <td
                    colSpan={COLUMNS.length + 2}
                    style={{ height: padBottom, padding: 0, border: 0 }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** One quiet pill per issuer token ("xStocks", "Ondo"…), as tokens.xyz marks secondary values. */
function IssuerChips({ stock }: { stock: Stock }) {
  return (
    <span className="hidden min-w-0 items-center gap-1 overflow-hidden md:flex">
      {stock.tokens.map((t) => (
        <span
          key={t.mint}
          title={`${t.symbol} · ${issuerLabel(t.issuer)}`}
          className="inline-flex shrink-0 items-center rounded-full bg-[#F2F3F5] px-2 py-0.5 text-[11px] leading-none font-semibold text-text-medium opacity-55 transition-[background-color,opacity] group-hover:opacity-100"
        >
          {issuerLabel(t.issuer)}
        </span>
      ))}
    </span>
  );
}

function TableSkeleton() {
  return (
    <section className={cn(SECTION, "pb-12 md:pb-24")} aria-busy aria-label="Loading stocks">
      <div className={cn(CARD, "overflow-hidden")}>
        <div className="flex h-12 items-center gap-6 border-b border-border-light bg-gray-50/80 px-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-16 rounded md:w-20" />
          ))}
        </div>
        <div className="divide-y divide-border-extra-light">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex h-16 items-center gap-4 px-4 md:px-8">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 md:w-40" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <section className={cn(SECTION, "pb-12 md:pb-24")}>
      <div className="rounded-[24px] border border-border-light bg-white p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.03)] md:rounded-[32px] md:p-12">
        <p className="text-[14px] text-text-low md:text-[16px]">{title}</p>
        {detail && <p className="mt-2 text-[12px] text-text-extra-low md:text-[14px]">{detail}</p>}
      </div>
    </section>
  );
}

"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantApi, type StockCompany } from "@/lib/api-client";
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  industryOptions,
  sectorOptions,
  withSectors,
  type BrowseFilters,
  type BrowseMetrics,
} from "@/lib/stocks/browse";

import { LiquidityBadge } from "./liquidity-badge";
import {
  FilterChip,
  LiquiditySelect,
  MultiSelectFilter,
  SORT_LABELS,
  SortControl,
  TypeSelect,
} from "./stock-filters";

const SEARCH_DEBOUNCE_MS = 200;

type Metrics = {
  metrics: Record<string, BrowseMetrics>;
  available: { mcap: boolean; change: boolean; return: boolean };
};

const formatChange = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;
const formatCap = (v: number) =>
  `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(v)}`;

/** Saves the filters in the query string (no history entry), keeping other parameters. */
function writeUrl(filters: BrowseFilters) {
  const params = filtersToParams(filters, new URLSearchParams(window.location.search));
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (url !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(window.history.state, "", url);
  }
}

/** Sector, industry, type and liquidity dropdowns plus sort: the desktop bar and the mobile sheet. */
function FilterControls({
  companies,
  filters,
  available,
  onChange,
  block,
}: {
  companies: StockCompany[];
  filters: BrowseFilters;
  available: Metrics["available"] | null;
  onChange: (next: BrowseFilters) => void;
  block?: boolean;
}) {
  return (
    <>
      <MultiSelectFilter
        label="Sector"
        allLabel="All sectors"
        options={sectorOptions(companies, filters)}
        selected={filters.sectors}
        onChange={(sectors) => onChange(withSectors(companies, filters, sectors))}
        block={block}
      />
      <MultiSelectFilter
        label="Industry"
        allLabel="All industries"
        options={industryOptions(companies, filters)}
        selected={filters.industries}
        onChange={(industries) => onChange({ ...filters, industries })}
        disabled={filters.sectors.length === 0}
        disabledHint="pick a sector first"
        searchable
        block={block}
      />
      <TypeSelect
        value={filters.type}
        onChange={(type) => onChange({ ...filters, type })}
        block={block}
      />
      <LiquiditySelect
        value={filters.liquidity}
        onChange={(liquidity) => onChange({ ...filters, liquidity })}
        block={block}
      />
      <SortControl
        filters={filters}
        available={available}
        onChange={(sort, dir) => onChange({ ...filters, sort, dir })}
        block={block}
      />
    </>
  );
}

/**
 * "Browse stocks": every company in the stock registry. Search, then compact
 * dropdowns for sector, industry, type, liquidity and sort (a "Filters" sheet
 * on phones), with chips for what's active. The filters live in the query
 * string, so a refresh or a shared link shows the same list. Clicking a
 * company asks the assistant about it.
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
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_FILTERS);
  const [searchText, setSearchText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<BrowseFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    const controller = new AbortController();
    assistantApi
      .stocks(controller.signal)
      .then((loaded) => {
        // Filters from the URL, matched against the sectors and industries that exist.
        const fromUrl = filtersFromParams(new URLSearchParams(window.location.search), {
          sectors: [...new Set(loaded.companies.map((c) => c.sector))],
          industries: [...new Set(loaded.companies.flatMap((c) => c.industry ?? []))],
        });
        setData(loaded);
        setFilters(fromUrl);
        setSearchText(fromUrl.search);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    fetch("/api/stocks/metrics", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Metrics>) : null))
      .then((loaded) => {
        const result = loaded ?? {
          metrics: {},
          available: { mcap: false, change: false, return: false },
        };
        setMetrics(result);
        // A shared link may sort by a figure this server doesn't have.
        setFilters((f) =>
          (f.sort === "mcap" && !result.available.mcap) ||
          (f.sort === "change" && !result.available.change) ||
          (f.sort === "return" && !result.available.return)
            ? { ...f, sort: "liquidity", dir: "desc" }
            : f,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMetrics({ metrics: {}, available: { mcap: false, change: false, return: false } });
      });
    return () => controller.abort();
  }, []);

  // Search waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchText]);

  // The URL follows the filters (once the stocks, and so the URL's filters, are loaded).
  useEffect(() => {
    if (data) writeUrl(filters);
  }, [data, filters]);

  const companies = useMemo(() => data?.companies ?? [], [data]);
  const shown = useMemo(
    () => applyFilters(companies, filters, metrics?.metrics),
    [companies, filters, metrics],
  );
  const activeCount = activeFilterCount(filters);
  const filtered = activeCount > 0 || filters.search.trim() !== "";

  const clearAll = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchText("");
  };

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.sectors.map((s) => ({
      key: `sector-${s}`,
      label: s,
      remove: () =>
        setFilters((f) =>
          withSectors(
            companies,
            f,
            f.sectors.filter((x) => x !== s),
          ),
        ),
    })),
    ...filters.industries.map((i) => ({
      key: `industry-${i}`,
      label: i,
      remove: () => setFilters((f) => ({ ...f, industries: f.industries.filter((x) => x !== i) })),
    })),
    ...(filters.type !== "all"
      ? [
          {
            key: "type",
            label: filters.type === "etf" ? "ETFs" : "Stocks",
            remove: () => setFilters((f) => ({ ...f, type: "all" as const })),
          },
        ]
      : []),
    ...(filters.liquidity !== "any"
      ? [
          {
            key: "liquidity",
            label: filters.liquidity === "high" ? "High liquidity" : "Medium+ liquidity",
            remove: () => setFilters((f) => ({ ...f, liquidity: "any" as const })),
          },
        ]
      : []),
    ...(filters.search.trim()
      ? [
          {
            key: "search",
            label: `“${filters.search.trim()}”`,
            remove: () => {
              setSearchText("");
              setFilters((f) => ({ ...f, search: "" }));
            },
          },
        ]
      : []),
  ];

  const metricOf = (c: StockCompany) => {
    const m = metrics?.metrics[c.ticker];
    if (filters.sort === "mcap" && m?.marketCap != null) return formatCap(m.marketCap);
    if (filters.sort === "return" && m?.return1y != null) return `1Y ${formatChange(m.return1y)}`;
    if (filters.sort === "change" && m?.change24h != null) return formatChange(m.change24h);
    return null;
  };

  return (
    <section
      aria-label="Browse stocks"
      className="flex h-full max-h-full flex-col gap-3 rounded-xl border p-3"
    >
      <h2 className="text-sm font-semibold">Browse stocks</h2>

      {/* Search (always), then the dropdowns, or a Filters button on phones */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-40 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search stocks by company or ticker"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchText("")}
            placeholder="Company or ticker"
            className="h-8 pl-7 text-sm [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 md:hidden"
          onClick={() => {
            setDraft(filters);
            setSheetOpen(true);
          }}
          disabled={!data}
        >
          <SlidersHorizontal /> Filters{activeCount > 0 && ` (${activeCount})`}
        </Button>
        {data && (
          <div className="hidden w-full flex-wrap items-center gap-1.5 md:flex">
            <FilterControls
              companies={companies}
              filters={filters}
              available={metrics?.available ?? null}
              onChange={setFilters}
            />
          </div>
        )}
      </div>

      {/* Active filters, and the count */}
      {data && (
        <div className="space-y-1.5">
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1" aria-label="Active filters">
              {chips.map((c) => (
                <FilterChip key={c.key} onRemove={c.remove}>
                  {c.label}
                </FilterChip>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="ml-1 rounded text-[11px] font-medium text-primary-text underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear all
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground tabular-nums" role="status">
            Showing {shown.length} of {companies.length} stocks
            {filters.sort !== "liquidity" && (
              <>
                {" "}
                · by {SORT_LABELS[filters.sort].toLowerCase()}
                {filters.sort !== "name" && metrics && " (missing figures last)"}
              </>
            )}
          </p>
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
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">No stocks match these filters</p>
            {filtered && (
              <Button variant="outline" size="sm" onClick={clearAll}>
                <X /> Clear filters
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((c) => {
              const metric = metricOf(c);
              return (
                <li key={c.ticker}>
                  <button
                    disabled={disabled}
                    onClick={() => onAsk(`Tell me about ${c.ticker}`)}
                    title={`Ask the assistant about ${c.ticker}`}
                    className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-[background-color,transform] outline-none hover:bg-primary/8 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] active:bg-muted disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-medium">{c.ticker}</span>
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
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <LiquidityBadge tier={c.liquidityTier} className="mt-0.5" />
                      {metric && (
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {metric}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Liquidity from a 100 USDC test quote. Click a stock to ask the assistant.
      </p>

      {/* Phones: every dropdown in a bottom sheet, applied together */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Showing {applyFilters(companies, draft, metrics?.metrics).length} of{" "}
              {companies.length} stocks with these filters.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 overflow-y-auto px-4 pb-2">
            <FilterControls
              companies={companies}
              filters={draft}
              available={metrics?.available ?? null}
              onChange={setDraft}
              block
            />
          </div>
          <SheetFooter className="flex-row gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() =>
                setDraft((d) => ({
                  ...DEFAULT_FILTERS,
                  search: d.search,
                  sort: d.sort,
                  dir: d.dir,
                }))
              }
            >
              Reset
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setFilters(draft);
                setSheetOpen(false);
              }}
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

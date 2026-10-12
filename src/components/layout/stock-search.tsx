"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Change } from "@/components/market/change";
import { formatPrice, formatUsdCompact } from "@/components/market/format";
import { issuerLabel, stockFigures } from "@/components/market/stock-figures";
import { TokenLogo } from "@/components/market/token-logo";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockSearch, useStocks } from "@/hooks/use-markets";
import type { Stock } from "@/lib/stocks/types";
import { cn } from "@/lib/utils";

/** Dispatch on `document` to open the palette (the hero search does). */
const OPEN_SEARCH_EVENT = "tickertape:open-search";
export const openSearch = () => document.dispatchEvent(new Event(OPEN_SEARCH_EVENT));

const TOP_COUNT = 50;

/* --- Recent searches: which companies, never their numbers (those are read live). --- */

type Recent = Pick<Stock, "ticker" | "name" | "icon">;
const RECENT_KEY = "tickertape.recent-stocks.v1";
const RECENT_MAX = 8;
const recentListeners = new Set<() => void>();
let recentCache: { raw: string | null; list: Recent[] } = { raw: null, list: [] };

function readRecent(): Recent[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RECENT_KEY);
  } catch {
    return [];
  }
  if (raw !== recentCache.raw) {
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      recentCache = { raw, list: Array.isArray(parsed) ? (parsed as Recent[]) : [] };
    } catch {
      recentCache = { raw, list: [] };
    }
  }
  return recentCache.list;
}

function remember({ ticker, name, icon }: Stock) {
  const next = [{ ticker, name, icon }, ...readRecent().filter((r) => r.ticker !== ticker)];
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, RECENT_MAX)));
  } catch {
    // Storage blocked: nothing is remembered.
  }
  recentListeners.forEach((l) => l());
}

const subscribeRecent = (listener: () => void) => {
  recentListeners.add(listener);
  return () => recentListeners.delete(listener);
};
const NO_RECENT: Recent[] = [];
const useRecent = () => useSyncExternalStore(subscribeRecent, readRecent, () => NO_RECENT);

/* --- Rows --- */

function StockRow({ stock, onSelect }: { stock: Stock; onSelect: (stock: Stock) => void }) {
  const { price, change24h, volume24h } = stockFigures(stock);
  return (
    <CommandItem value={stock.ticker} onSelect={() => onSelect(stock)} className="gap-3">
      <TokenLogo src={stock.icon} symbol={stock.ticker} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-text-extra-high">{stock.name}</span>
          <span className="max-w-[180px] truncate text-sm text-text-low">{stock.ticker}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-extra-low">
          <span className="tabular-nums">{formatPrice(price)}</span>
          {volume24h != null && volume24h > 0 && (
            <span className="tabular-nums">Vol: {formatUsdCompact(volume24h)}</span>
          )}
          <span className="truncate">
            {stock.tokens.map((t) => issuerLabel(t.issuer)).join(" · ")}
          </span>
        </div>
      </div>
      <Change pct={change24h} tone="accent" className="text-xs font-medium" />
    </CommandItem>
  );
}

function RecentRow({ recent, onSelect }: { recent: Recent; onSelect: (r: Recent) => void }) {
  return (
    <CommandItem
      value={`recent:${recent.ticker}`}
      onSelect={() => onSelect(recent)}
      className="gap-3"
    >
      <TokenLogo src={recent.icon} symbol={recent.ticker} />
      <span className="truncate font-medium text-text-extra-high">{recent.name}</span>
      <span className="text-sm text-text-low">{recent.ticker}</span>
    </CommandItem>
  );
}

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, i) => (
    <CommandItem key={i} disabled value={`loading:${i}`} className="gap-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <Skeleton className="h-3 w-10 rounded" />
    </CommandItem>
  ));
}

/** The palette itself: recent companies and the busiest 50, or Jupiter's search results. */
function StockSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const recent = useRecent();
  const search = useStockSearch(query);
  const list = useStocks();
  const hasQuery = query.trim().length > 0;

  const top = useMemo(() => {
    const stocks = list.data?.stocks ?? [];
    return stocks
      .map((stock) => ({ stock, volume: stockFigures(stock).volume24h ?? -1 }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, TOP_COUNT)
      .map(({ stock }) => stock);
  }, [list.data]);

  const go = (ticker: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(`/stocks/${encodeURIComponent(ticker)}`);
  };
  const select = (stock: Stock) => {
    remember(stock);
    go(stock.ticker);
  };

  const results = search.data?.stocks ?? [];
  const body = hasQuery ? (
    search.error && !search.loading ? (
      <CommandGroup heading="Search results">
        <CommandItem disabled value="search-error" className="text-text-low">
          Couldn&apos;t search right now. {search.error}
        </CommandItem>
      </CommandGroup>
    ) : search.loading ? (
      <CommandGroup heading="Search results">
        <SkeletonRows />
      </CommandGroup>
    ) : results.length > 0 ? (
      <CommandGroup heading="Search results">
        {results.map((stock) => (
          <StockRow key={stock.ticker} stock={stock} onSelect={select} />
        ))}
      </CommandGroup>
    ) : (
      <CommandEmpty>No results found.</CommandEmpty>
    )
  ) : (
    <>
      {recent.length > 0 && (
        <CommandGroup heading="Recent">
          {recent.map((r) => (
            <RecentRow key={r.ticker} recent={r} onSelect={(x) => go(x.ticker)} />
          ))}
        </CommandGroup>
      )}
      <CommandGroup heading="Top by volume">
        {list.error && !list.data ? (
          <CommandItem disabled value="list-error" className="text-text-low">
            Couldn&apos;t load stocks. {list.error}
          </CommandItem>
        ) : list.data ? (
          top.map((stock) => <StockRow key={stock.ticker} stock={stock} onSelect={select} />)
        ) : (
          <SkeletonRows />
        )}
      </CommandGroup>
    </>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title="Search stocks"
    >
      <CommandInput placeholder="Search stocks" value={query} onValueChange={setQuery} />
      <CommandList className="h-[400px] max-h-[400px]">{body}</CommandList>
    </CommandDialog>
  );
}

/** The ⌘ K keycaps on search triggers. */
export const CommandKeys = ({ size }: { size: "sm" | "md" }) => (
  <span className="flex items-center gap-1" aria-hidden>
    {["⌘", "K"].map((k) => (
      <kbd
        key={k}
        className={cn(
          "inline-flex items-center justify-center rounded-sm bg-gray-100 font-sans leading-none font-medium text-text-medium",
          size === "sm" ? "size-5 text-[10px]" : "size-6 text-xs",
        )}
      >
        {k}
      </kbd>
    ))}
  </span>
);

/**
 * The header's search trigger (a 320px pill with ⌘K), and the palette it opens.
 * ⌘K / Ctrl+K and OPEN_SEARCH_EVENT open it from anywhere.
 */
export function StockSearch() {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        show();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, [show]);

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label="Search stocks"
        className="group flex w-auto cursor-pointer items-center justify-between gap-2 rounded-full border border-transparent bg-transparent px-3 py-2 text-sm text-text-low transition-[border-color,background-color,transform] hover:border-border-medium hover:text-text-medium active:scale-[0.98] motion-reduce:transition-none sm:w-[320px] sm:border-border-medium sm:bg-white"
      >
        <span className="flex items-center gap-2">
          <Search
            className="size-4 text-text-low transition-colors group-hover:text-text-medium"
            aria-hidden
          />
          <span className="hidden transition-colors group-hover:text-text-medium sm:inline">
            Find stocks...
          </span>
        </span>
        <span className="hidden sm:flex">
          <CommandKeys size="sm" />
        </span>
      </button>
      {open && <StockSearchDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

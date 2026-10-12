"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Change } from "@/components/market/change";
import {
  formatAgo,
  formatDate,
  formatInteger,
  formatPrice,
  formatUsdCompact,
} from "@/components/market/format";
import { issuerLabel } from "@/components/market/stock-figures";
import { TokenLogo } from "@/components/market/token-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useStock } from "@/hooks/use-markets";
import { useNow } from "@/hooks/use-now";
import type { Stock, StockToken } from "@/lib/stocks/types";
import { cn } from "@/lib/utils";

import { PriceChart } from "./price-chart";
import { TradePanel } from "./trade-panel";

const shortMint = (mint: string) => `${mint.slice(0, 4)}…${mint.slice(-4)}`;
const solscan = (mint: string) => `https://solscan.io/token/${mint}`;

/** The stock page, read live from GET /api/stocks/[ticker] (again every minute while visible). */
export function StockPage({ ticker }: { ticker: string }) {
  const { data, error, status } = useStock(ticker);

  if (!data) {
    if (status === 404) {
      return (
        <Shell>
          <Notice title={`${ticker.toUpperCase()} isn't listed`} />
        </Shell>
      );
    }
    return <Shell>{error ? <Notice title={error} /> : <StockSkeleton />}</Shell>;
  }
  return <StockView stock={data.stock} asOf={data.asOf} refreshError={error} />;
}

function StockView({
  stock,
  asOf,
  refreshError,
}: {
  stock: Stock;
  asOf: string;
  refreshError: string | null;
}) {
  // The selected issuer's token; the most liquid one until the user picks another.
  const [mint, setMint] = useState(stock.tokens[0]!.mint);
  const token = stock.tokens.find((t) => t.mint === mint) ?? stock.tokens[0]!;
  const now = useNow();

  return (
    <Shell icon={stock.icon}>
      <Breadcrumb name={stock.name} />
      <div className="mx-auto max-w-7xl px-6 pt-0">
        {refreshError && (
          <p
            role="status"
            className="mb-6 rounded-2xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-[13px] text-status-warning-text"
          >
            Not updated since {now ? formatAgo(asOf, now) : "the last read"}: {refreshError}
          </p>
        )}
        <Header stock={stock} token={token} onSelect={(t) => setMint(t.mint)} />
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          <div className="space-y-16 lg:col-span-8">
            <PriceChart key={token.mint} mint={token.mint} livePrice={token.price} />
            <Stats token={token} />
            <Variants stock={stock} selected={token.mint} onSelect={(t) => setMint(t.mint)} />
          </div>
          <aside className="lg:sticky lg:top-24 lg:col-span-4">
            <TradePanel stock={stock} token={token} onTokenChange={(t) => setMint(t.mint)} />
          </aside>
        </div>
      </div>
    </Shell>
  );
}

/** The page frame, with tokens.xyz's faint blurred-logo backdrop when there is a logo. */
function Shell({ icon, children }: { icon?: string | null; children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-white pb-24">
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute top-[-400px] left-1/2 size-[1500px] max-w-none -translate-x-1/2 object-cover opacity-[0.03] blur-[100px]"
        />
      )}
      <div className="relative z-10">{children}</div>
    </main>
  );
}

function Breadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="Breadcrumb" className="relative z-10 mt-24">
      <ol className="text-body-md mx-auto flex max-w-7xl items-center gap-1.5 px-6 py-4">
        <li>
          <Link href="/explore" className="font-medium text-text-medium hover:text-text-extra-high">
            Stocks
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="size-3.5 text-text-extra-low" />
        </li>
        <li aria-current="page" className="truncate font-medium text-text-extra-high">
          {name}
        </li>
      </ol>
    </nav>
  );
}

function Header({
  stock,
  token,
  onSelect,
}: {
  stock: Stock;
  token: StockToken;
  onSelect: (token: StockToken) => void;
}) {
  return (
    <div className="mb-8 flex items-start gap-5">
      <TokenLogo
        src={stock.icon}
        symbol={stock.ticker}
        className="size-[60px] text-base ring-3 ring-border-extra-light"
      />
      <div className="min-w-0 space-y-2">
        <h1 className="text-title-md font-semibold text-text-extra-high">
          <CopyName name={stock.name} mint={token.mint} />
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[var(--badge-default-bg)] px-2 py-1 text-xs font-medium text-[var(--badge-default-text)] backdrop-blur-sm">
            {stock.ticker}
          </span>
          {stock.tokens.map((t) => (
            <button
              key={t.mint}
              type="button"
              aria-pressed={t.mint === token.mint}
              onClick={() => onSelect(t)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                t.mint === token.mint
                  ? "border-border-medium bg-white text-text-extra-high"
                  : "border-border-light bg-gray-50 text-text-medium hover:border-border-medium hover:text-text-extra-high",
              )}
            >
              <TokenLogo src={t.icon} symbol={t.symbol} className="size-4 text-[7px]" />
              {t.symbol}
              <span className="text-text-low">· {issuerLabel(t.issuer)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The name, as a button that copies the selected token's mint (a check confirms it). */
function CopyName({ name, mint }: { name: string; mint: string }) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      title="Copy mint address"
      aria-label={`${name}: copy mint address`}
      onClick={() => void navigator.clipboard.writeText(mint).then(() => setCopied(true))}
      className="group/name -mx-2 inline-flex max-w-full cursor-pointer items-center gap-2 rounded-[12px] px-2 py-0.5 text-left transition-colors outline-none hover:bg-soft focus-visible:bg-soft focus-visible:ring-2 focus-visible:ring-gray-1200"
    >
      <span className="truncate">{name}</span>
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center text-ink-muted transition-opacity",
          copied
            ? "opacity-100"
            : "opacity-0 group-hover/name:opacity-100 group-focus-visible/name:opacity-100",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "check" : "copy"}
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduce ? undefined : { scale: 0.6, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.15 }}
            className="inline-flex"
          >
            <Icon className="size-4" aria-hidden />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

/** tokens.xyz's stats: rows of four separated by hairlines, no card. */
function Stats({ token }: { token: StockToken }) {
  const rows: [string, ReactNode][][] = [
    [
      ["Price", formatPrice(token.price)],
      ["24H Change", <Change key="c" pct={token.change24h} tone="accent" />],
      ["Liquidity", formatUsdCompact(token.liquidity)],
      ["24H Volume", formatUsdCompact(token.volume24h)],
    ],
    [
      ["Market Cap", formatUsdCompact(token.marketCap)],
      ["Holders", formatInteger(token.holders)],
      ["Decimals", String(token.decimals)],
      ["Listed on Jupiter", formatDate(token.createdAt)],
    ],
  ];
  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="text-title-md mt-12 mb-6 text-text-extra-high">
        Stats <span className="text-text-low">· {token.symbol}</span>
      </h2>
      {rows.map((row, i) => (
        <dl
          key={i}
          className={cn(
            "grid grid-cols-2 md:grid-cols-4 [&>*]:border-border-light [&>*:nth-child(even)]:border-l md:[&>*:nth-child(n+2)]:border-l max-md:[&>*:nth-child(n+3)]:border-t",
            i > 0 && "border-t border-border-light",
          )}
        >
          {row.map(([label, value]) => (
            <div key={label} className="py-5 pr-6 pl-6 first:pl-0 max-md:odd:pl-0">
              <dt className="text-body-md text-text-medium">{label}</dt>
              <dd className="text-title-sm mt-1 text-text-extra-high tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ))}
    </section>
  );
}

/** Every issuer's token for the company, as tokens.xyz lists an asset's variants. */
function Variants({
  stock,
  selected,
  onSelect,
}: {
  stock: Stock;
  selected: string;
  onSelect: (token: StockToken) => void;
}) {
  return (
    <section aria-labelledby="variants-heading">
      <h2 id="variants-heading" className="text-title-md mb-6 text-text-extra-high">
        Tokens <span className="text-text-low">· {stock.tokens.length}</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stock.tokens.map((t) => (
          <div
            key={t.mint}
            className={cn(
              "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-white p-3 shadow-[0_8px_40px_rgba(0,0,0,0.03)] transition-[border-color,box-shadow] hover:shadow-[0_12px_48px_rgba(0,0,0,0.06)]",
              t.mint === selected
                ? "border-border-strong"
                : "border-border-light hover:border-border-medium",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(t)}
              aria-pressed={t.mint === selected}
              className="flex items-center gap-2 text-left after:absolute after:inset-0 after:content-['']"
            >
              <TokenLogo src={t.icon} symbol={t.symbol} className="size-8" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-text-extra-high">
                  {t.symbol}
                </span>
                <span className="block text-xs text-text-low">{issuerLabel(t.issuer)}</span>
              </span>
            </button>
            <dl className="grid grid-cols-2 gap-2">
              {(
                [
                  ["Price", formatPrice(t.price)],
                  ["Liquidity", formatUsdCompact(t.liquidity)],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[9px] tracking-wide text-text-low uppercase">{label}</dt>
                  <dd className="text-[12px] text-text-extra-high tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <a
              href={solscan(t.mint)}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex w-fit items-center gap-1 font-mono text-[11px] text-text-low hover:text-text-extra-high"
            >
              {shortMint(t.mint)} <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The page while its stock loads (also the route's Suspense fallback). */
export function StockSkeleton() {
  return (
    <div className="mx-auto mt-24 max-w-7xl px-6 pt-4" aria-busy aria-label="Loading stock">
      <Skeleton className="h-4 w-40" />
      <div className="mt-8 flex items-center gap-5">
        <Skeleton className="size-[60px] rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-5 w-40 rounded-full" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-gray-50" />
        </div>
        <Skeleton className="h-[420px] rounded-[32px] lg:col-span-4" />
      </div>
    </div>
  );
}

function Notice({ title }: { title: string }) {
  return (
    <div className="mx-auto mt-32 max-w-3xl px-6">
      <div className="rounded-[24px] border border-border-light bg-white p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.03)] md:rounded-[32px] md:p-12">
        <p className="text-[14px] text-text-low md:text-[16px]">{title}</p>
        <Link
          href="/explore"
          className="mt-6 inline-flex h-9 items-center rounded-full bg-text-extra-high px-3.5 text-[length:var(--text-button-md)] font-semibold text-background hover:bg-text-high active:scale-[0.96]"
        >
          All stocks
        </Link>
      </div>
    </div>
  );
}

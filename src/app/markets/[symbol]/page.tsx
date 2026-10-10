import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

import { StockDetail } from "@/components/markets/stock-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { ISSUER_NAMES } from "@/lib/stocks/types";
import { companyTokens, listTickers } from "@/server/markets/screener";

type Params = PageProps<"/markets/[symbol]">["params"];

/** Every listed stock gets a page, built ahead of time; its live data loads in the browser. */
export function generateStaticParams() {
  return listTickers().map((symbol) => ({ symbol }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { symbol } = await params;
  const c = companyTokens(symbol);
  return c
    ? {
        title: `${c.best.companyName} (${c.best.ticker})`,
        description: `Live ${c.best.ticker} price, chart and trading on Solana.`,
      }
    : {};
}

/** /markets/[symbol]: one stock's live price, chart, stats and trade panel. */
export default function StockPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <Link
        href="/markets"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden /> All stocks
      </Link>
      {/* The symbol comes from the URL, so this part streams in behind a placeholder. */}
      <Suspense fallback={<Skeleton className="h-[36rem] w-full rounded-2xl" />}>
        <Stock params={params} />
      </Suspense>
      <p className="mt-12 text-center text-xs text-muted-foreground">
        Research only. Not financial advice.
      </p>
    </main>
  );
}

async function Stock({ params }: { params: Params }) {
  const { symbol } = await params;
  const c = companyTokens(symbol);
  if (!c) notFound();
  const { best } = c;
  return (
    <StockDetail
      name={best.companyName}
      token={{
        ticker: best.ticker,
        symbol: best.symbol,
        issuer: ISSUER_NAMES[best.issuer],
        mint: best.mint,
        decimals: best.decimals,
        preIpo: best.preIpo,
      }}
    />
  );
}

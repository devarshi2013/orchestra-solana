import type { Metadata } from "next";
import { Suspense } from "react";

import { HeroSearch } from "@/components/home/hero-search";
import { HomeStocks, HomeStocksSkeleton } from "@/components/home/home-stocks";

/**
 * Explore (/explore), laid out like tokens.xyz: a headline over the big search
 * field, then three highlight cards, issuer tabs and every listed stock, all
 * read live from Jupiter (GET /api/stocks).
 */
export const metadata: Metadata = { title: "Explore" };

export default function Explore() {
  return (
    <main className="relative min-h-dvh space-y-12 overflow-x-hidden bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-gray-1400/5 to-transparent" />
      <section className="relative mx-auto mt-12 max-w-7xl px-6 pt-28 pb-12">
        <div className="mx-auto max-w-4xl text-center text-pretty">
          <h1 className="text-[44px] leading-[1.02] font-medium text-balance text-text-extra-high md:text-[54px]">
            Tokenized stocks on Solana
          </h1>
        </div>
        <div className="mt-10">
          <HeroSearch />
        </div>
      </section>
      {/* The issuer tab is read from the URL (?issuer=), which needs a Suspense boundary. */}
      <Suspense fallback={<HomeStocksSkeleton />}>
        <HomeStocks />
      </Suspense>
    </main>
  );
}

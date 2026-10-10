import type { Metadata } from "next";

import { Screener } from "@/components/markets/screener";

export const metadata: Metadata = {
  title: "Stocks Screener",
  description: "Live prices for tokenized US stocks on Solana.",
};

/** /markets: live prices for every tokenized US stock Quill lists, sortable, with a page per stock. */
export default function MarketsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Stocks Screener</h1>
        <p className="text-muted-foreground">Live prices for tokenized US stocks</p>
      </header>
      <Screener />
      <p className="mt-12 text-center text-xs text-muted-foreground">
        Research only. Not financial advice.
      </p>
    </main>
  );
}

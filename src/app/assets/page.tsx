import type { Metadata } from "next";

import { AssetsExplorer } from "@/components/assets/assets-explorer";

export const metadata: Metadata = { title: "Stocks · Orchestra" };

export default function AssetsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tokenized stocks</h1>
        <p className="text-sm text-muted-foreground">
          The tokenized US stocks the assistant can research and buy for you. We never issue tokens;
          we list existing ones (xStocks and Ondo) tradable on Solana through Jupiter, each verified
          against Jupiter&apos;s token list.
        </p>
      </div>
      <AssetsExplorer />
    </main>
  );
}

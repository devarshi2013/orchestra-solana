import type { Metadata } from "next";

import { AssetsExplorer } from "@/components/assets/assets-explorer";

export const metadata: Metadata = { title: "Assets · Orchestra" };

export default function AssetsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
        <p className="text-sm text-muted-foreground">
          Everything Orchestra can put in a symphony. We never issue tokens; we list existing ones
          tradable on Solana through Jupiter, each verified against Jupiter&apos;s token list.
        </p>
      </div>
      <AssetsExplorer />
    </main>
  );
}

import type { Metadata } from "next";

import { SwapCard } from "@/components/swap/swap-card";

export const metadata: Metadata = { title: "Swap · Orchestra" };

export default function SwapPage() {
  return (
    <main className="flex flex-1 justify-center px-4 py-12">
      <SwapCard />
    </main>
  );
}

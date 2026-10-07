import type { Metadata } from "next";

import { BacktestRunner } from "@/components/backtest/backtest-runner";

export const metadata: Metadata = { title: "Backtest · Orchestra" };

export default function BacktestPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Backtest</h1>
        <p className="text-sm text-muted-foreground">
          Replay a symphony on stored daily prices, with fees and slippage, against holding SOL.
        </p>
      </div>
      <BacktestRunner />
    </main>
  );
}

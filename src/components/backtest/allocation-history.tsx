import { CASH_MINT } from "@/lib/backtest/engine";
import { formatPercent, formatUsd } from "@/lib/backtest/format";
import type { RebalanceRecord } from "@/lib/backtest/types";
import { describeWarning } from "@/lib/symphony/warnings";

/** One row per rebalance: what the symphony asked for and what it cost. */
export function AllocationHistory({
  rebalances,
  symbolOf,
}: {
  rebalances: readonly RebalanceRecord[];
  symbolOf: (mint: string) => string;
}) {
  const label = (mint: string) => (mint === CASH_MINT ? "USDC" : symbolOf(mint));
  return (
    <div className="max-h-96 overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Traded on</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-3 py-2 text-right font-medium">Trades</th>
            <th className="px-3 py-2 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rebalances.map((r) => {
            const notes = [
              ...r.warnings.map((w) => describeWarning(w, symbolOf)),
              ...r.unpriced.map(
                (m) => `${symbolOf(m)} had no price yet; its weight stayed in USDC.`,
              ),
            ];
            return (
              <tr key={r.date} className="border-t align-top">
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {r.date}
                  <div className="text-xs text-muted-foreground">on {r.decidedOn} close</div>
                </td>
                <td className="px-3 py-2">
                  {Object.entries(r.target)
                    .sort(([, a], [, b]) => b - a)
                    .map(([mint, weight]) => `${label(mint)} ${formatPercent(weight, 0)}`)
                    .join(" · ")}
                  {notes.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                      {notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.trades.length}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatUsd(r.cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

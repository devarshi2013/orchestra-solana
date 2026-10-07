import { formatPercent, formatRatio, formatUsd } from "@/lib/backtest/format";
import type { BacktestResult, Metrics } from "@/lib/backtest/types";

const ROWS: { label: string; hint?: string; format: (m: Metrics) => string }[] = [
  { label: "Total return", format: (m) => formatPercent(m.totalReturn) },
  { label: "CAGR", hint: "annualized over 365 days", format: (m) => formatPercent(m.cagr) },
  { label: "Max drawdown", format: (m) => formatPercent(-m.maxDrawdown) },
  { label: "Volatility", hint: "annualized", format: (m) => formatPercent(m.volatility) },
  { label: "Sharpe", hint: "risk-free 0", format: (m) => formatRatio(m.sharpe) },
  { label: "Sortino", format: (m) => formatRatio(m.sortino) },
  { label: "Win rate", hint: "share of up days", format: (m) => formatPercent(m.winRate, 0) },
];

export function MetricsTable({ result }: { result: BacktestResult }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="py-1.5 font-medium">Metric</th>
          <th className="py-1.5 text-right font-medium">Strategy</th>
          <th className="py-1.5 text-right font-medium">Hold SOL</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.label} className="border-t">
            <td className="py-1.5">
              {row.label}
              {row.hint && <span className="ml-1.5 text-xs text-muted-foreground">{row.hint}</span>}
            </td>
            <td className="py-1.5 text-right font-medium">{row.format(result.metrics)}</td>
            <td className="py-1.5 text-right">
              {result.benchmark ? row.format(result.benchmark) : "—"}
            </td>
          </tr>
        ))}
        <tr className="border-t">
          <td className="py-1.5">Fees + slippage paid</td>
          <td className="py-1.5 text-right font-medium">{formatUsd(result.totalCost)}</td>
          <td className="py-1.5 text-right">—</td>
        </tr>
      </tbody>
    </table>
  );
}

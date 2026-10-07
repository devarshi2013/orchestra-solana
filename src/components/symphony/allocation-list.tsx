export type AllocationRow = { mint: string; symbol: string; weight: number };

/** Target weights, largest first, with a bar per token. */
export function AllocationList({ rows }: { rows: readonly AllocationRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map(({ mint, symbol, weight }) => (
        <li key={mint} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{symbol}</span>
            <span className="text-muted-foreground tabular-nums">{(weight * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-200"
              style={{ width: `${weight * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

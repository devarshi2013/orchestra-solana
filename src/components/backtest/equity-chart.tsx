"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDay, formatUsd } from "@/lib/backtest/format";
import type { EquityPoint } from "@/lib/backtest/types";

type SeriesKey = "value" | "benchmark";
/**
 * Validated categorical slots 1–2 (globals.css). The legend's `bg-series-*`
 * classes also keep Tailwind from dropping the variables.
 */
const SERIES: { key: SeriesKey; label: string; color: string; swatch: string }[] = [
  { key: "value", label: "Strategy", color: "var(--series-1)", swatch: "bg-series-1" },
  { key: "benchmark", label: "Hold SOL", color: "var(--series-2)", swatch: "bg-series-2" },
];

/** Strategy vs. hold-SOL equity (Recharts), with a crosshair tooltip and a table view. */
export function EquityChart({
  points,
  height = 260,
}: {
  points: readonly EquityPoint[];
  height?: number;
}) {
  const series = SERIES.filter((s) => points.every((p) => p[s.key] !== null));
  const last = points.length - 1;

  return (
    <figure className="space-y-3">
      <ul className="flex gap-4 text-sm text-muted-foreground" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={`h-0.5 w-4 rounded-full ${s.swatch}`} />
            {s.label}
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={[...points]} margin={{ top: 8, right: 64, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v: number) => formatUsd(v, true)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
            width={52}
          />
          <Tooltip
            content={(props) => <EquityTooltip {...props} series={series} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
              isAnimationActive={false}
              label={({ x, y, index }) =>
                index === last ? (
                  <text
                    key={s.key}
                    x={Number(x) + 8}
                    y={Number(y)}
                    dy="0.32em"
                    className="fill-foreground text-[11px] font-medium"
                  >
                    {s.label}
                  </text>
                ) : null
              }
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show data table</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1 font-medium">Date</th>
                {series.map((s) => (
                  <th key={s.key} className="px-2 py-1 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t">
                  <td className="px-2 py-1">{p.date}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-2 py-1 text-right">
                      {formatUsd(p[s.key]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Values lead, series names follow; keyed with a short line in the series color. */
function EquityTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  label?: unknown;
  series: typeof SERIES;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload as EquityPoint;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <div className="mb-1 text-muted-foreground">{formatDay(String(label))}</div>
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className={`h-0.5 w-3 rounded-full ${s.swatch}`} />
          <span className="font-semibold tabular-nums">{formatUsd(point[s.key]!)}</span>
          <span className="text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A price candle as the chart routes return it (time in unix seconds). */
export type Candle = { time: number; open: number; high: number; low: number; close: number };

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

/** "$64.1B", "$5.55M", "$958K"; "—" when there's no figure. */
export function formatCompactUsd(value: number | null): string {
  return value !== null && Number.isFinite(value) ? `$${compact.format(value)}` : "—";
}

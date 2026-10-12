/** How tokens.xyz shows numbers; every missing figure is an em dash, never a guess. */

const MISSING = "—";
const known = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

/** $1,234.56 · $0.4321 · $0.001234 · $0.00000573 */
export function formatPrice(price: number | null | undefined): string {
  if (!known(price)) return MISSING;
  if (price === 0) return "$0.00";
  if (price < 0.00001) {
    const decimals = Math.min(20, Math.max(0, 2 - Math.floor(Math.log10(Math.abs(price)))));
    return `$${price.toFixed(decimals)}`;
  }
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** $1.23B · $4.56M · $7.89K · $12.34 */
export function formatUsdCompact(value: number | null | undefined): string {
  if (!known(value)) return MISSING;
  const [div, unit] =
    value >= 1e9 ? [1e9, "B"] : value >= 1e6 ? [1e6, "M"] : value >= 1e3 ? [1e3, "K"] : [1, ""];
  return `$${(value / div).toFixed(2)}${unit}`;
}

/** 12,345 */
export function formatInteger(value: number | null | undefined): string {
  return known(value) ? Math.round(value).toLocaleString("en-US") : MISSING;
}

/** 1.23% (no sign: the triangle shows the direction) */
export const formatPctAbs = (pct: number) => `${Math.abs(pct).toFixed(2)}%`;

/** "Oct 11, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? MISSING
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "4 min ago", for when a list was last read. */
export function formatAgo(iso: string, now: number): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
}

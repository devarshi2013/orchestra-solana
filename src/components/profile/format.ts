/** Number formats for the profile; a missing figure is an em dash, never a guess. */

export const usd = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const signedUsd = (n: number) => `${n < 0 ? "−" : "+"}${usd(n)}`;
export const qty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Green for gains, red for losses, muted when there's no figure. */
export const tone = (n: number | null | undefined) =>
  n == null ? "text-ink-muted" : n < 0 ? "text-red-700" : "text-emerald-700";

/** Hidden balances read as dots (metengine's eye toggle). */
export const HIDDEN = "••••••";

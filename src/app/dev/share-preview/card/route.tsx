import { notFound } from "next/navigation";

import { pnlCardImage } from "@/components/share/pnl-card";

/** Dev-only: the P&L card with clearly sample figures, to check the populated layout. */
export function GET() {
  if (process.env.NODE_ENV === "production") notFound();
  return pnlCardImage({
    wallet: "3jupp7SHa9dKKnqEMHrhrzi6KXinwEjYNgqET4CgA21u",
    period: "all",
    data: {
      value: 4823.17,
      change: { pnl: 612.4, pct: 14.54 },
      top: [
        { mint: "a", symbol: "NVDAx", pnl: 301.2, pnlPct: 22.31, logo: null },
        { mint: "b", symbol: "MU", pnl: 188.9, pnlPct: 11.08, logo: null },
        { mint: "c", symbol: "TSLAx", pnl: -42.1, pnlPct: -3.27, logo: null },
      ],
    },
  });
}

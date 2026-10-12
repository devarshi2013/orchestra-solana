import type { LivePrices } from "@/hooks/use-live-prices";
import type { Fill, Position, ProfileResponse } from "@/lib/strategies/types";

export type ValuedPosition = Position & {
  price: number | null;
  change24h: number | null;
  value: number | null;
  /** P&L of the recorded tokens at the live price (null without recorded buys or a price). */
  pnl: number | null;
  pnlPct: number | null;
};

/**
 * Positions at live prices, and the portfolio totals. P&L covers only the
 * tokens recorded buys account for; a total that needs a missing price is null.
 */
export function summarize(profile: ProfileResponse, prices: LivePrices["prices"]) {
  const rows: ValuedPosition[] = profile.positions.map((p) => {
    const live = prices[p.mint];
    const price = live?.price ?? null;
    const pnl =
      price == null || p.costBasis == null ? null : p.recordedAmount * price - p.costBasis;
    return {
      ...p,
      price,
      change24h: live?.change24h ?? null,
      value: price == null ? null : p.tokenAmount * price,
      pnl,
      pnlPct: pnl == null || !p.costBasis ? null : (pnl / p.costBasis) * 100,
    };
  });
  const allPriced = rows.every((r) => r.value != null);
  const stocks = allPriced ? rows.reduce((sum, r) => sum + r.value!, 0) : null;
  const recorded = rows.filter((r) => r.pnl != null);
  const pnl = recorded.length ? recorded.reduce((sum, r) => sum + r.pnl!, 0) : null;
  const invested = recorded.reduce((sum, r) => sum + r.costBasis!, 0);
  // Today's move of the stocks held: each position's value now against its value 24h ago.
  const moved = rows.filter((r) => r.value != null && r.change24h != null);
  const day =
    rows.length > 0 && moved.length === rows.length
      ? moved.reduce((sum, r) => sum + (r.value! - r.value! / (1 + r.change24h! / 100)), 0)
      : null;
  const ranked = recorded.filter((r) => r.pnlPct != null).sort((a, b) => b.pnlPct! - a.pnlPct!);
  return {
    rows: [...rows].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)),
    stocks,
    total: stocks == null ? null : stocks + profile.usdcBalance,
    pnl,
    invested: recorded.length ? invested : null,
    pnlPct: pnl == null || !invested ? null : (pnl / invested) * 100,
    day,
    dayPct: day == null || stocks == null || stocks === day ? null : (day / (stocks - day)) * 100,
    best: ranked[0] ?? null,
    worst: ranked.length > 1 ? ranked.at(-1)! : null,
  };
}

/** The profile lists at most this many recent fills; with fewer, the list is every recorded trade. */
const FILLS_LISTED = 50;

/** Trades per day (UTC). */
export type ActivityDay = { date: string; trades: number; volume: number };

/**
 * Trade counts, realized P&L (sell proceeds minus their average cost) and
 * daily activity from the listed fills. With a full list the oldest trades may
 * be missing, so realized P&L is unknown then rather than understated.
 */
export function tradeStats(fills: Fill[]) {
  const complete = fills.length < FILLS_LISTED;
  const books = new Map<string, { qty: number; cost: number }>();
  let realized: number | null = null;
  for (const fill of [...fills].reverse()) {
    const book = books.get(fill.mint) ?? { qty: 0, cost: 0 };
    if (fill.side === "buy") {
      book.qty += fill.tokenAmount;
      book.cost += fill.usdcAmount;
    } else if (book.qty > 0) {
      const sold = Math.min(fill.tokenAmount, book.qty);
      const cost = (book.cost / book.qty) * sold;
      realized = (realized ?? 0) + fill.usdcAmount * (sold / fill.tokenAmount) - cost;
      book.cost -= cost;
      book.qty -= sold;
    }
    books.set(fill.mint, book);
  }
  const days = new Map<string, ActivityDay>();
  for (const fill of fills) {
    const date = fill.blockTime.slice(0, 10);
    const day = days.get(date) ?? { date, trades: 0, volume: 0 };
    day.trades += 1;
    day.volume += fill.usdcAmount;
    days.set(date, day);
  }
  return {
    trades: fills.length,
    complete,
    buys: fills.filter((f) => f.side === "buy").length,
    sells: fills.filter((f) => f.side === "sell").length,
    realized: complete ? realized : null,
    activity: [...days.values()],
  };
}

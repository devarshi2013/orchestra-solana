import "server-only";

import type {
  Fill,
  HistoryPeriod,
  Position,
  PortfolioHistoryResponse,
  PortfolioPoint,
} from "@/lib/strategies/types";
import { db, T } from "@/server/db";
import { livePrices } from "@/server/prices";
import { stockCandles } from "@/server/stocks/history";
import { holdings } from "@/server/strategies/profile";

/**
 * Portfolio history, one point per wallet per UTC day, from real data only:
 * the watcher's daily snapshots (every listed stock token held plus USDC, at
 * Jupiter's live price), a one-time backfill rebuilt from the wallet's
 * recorded fills × each token's daily close (only days every holding has a
 * close for), and today's live value. A day that can't be valued exactly is
 * left out, never estimated.
 */

const DAY_S = 86_400;
const PERIOD_DAYS: Record<HistoryPeriod, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
/** Wallets snapshotted per watcher pass (each costs an RPC read). */
const SNAPSHOTS_PER_RUN = 25;

const dayStart = (date: Date) => Math.floor(date.getTime() / 1000 / DAY_S) * DAY_S;
const isoDay = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

type Valued = { value: number; costBasis: number; pnl: number; positions: object[] };

/** The holdings at live prices; null when any holding has no price (never a partial value). */
function valueAt(
  positions: Position[],
  usdc: number,
  prices: Awaited<ReturnType<typeof livePrices>>,
): Valued | null {
  let value = usdc;
  let costBasis = 0;
  let recordedValue = 0;
  const rows: object[] = [];
  for (const p of positions) {
    const price = prices[p.mint]?.price;
    if (price == null) return null;
    value += p.tokenAmount * price;
    costBasis += p.costBasis ?? 0;
    recordedValue += p.recordedAmount * price;
    rows.push({ mint: p.mint, symbol: p.symbol, amount: p.tokenAmount, price });
  }
  return { value, costBasis, pnl: recordedValue - costBasis, positions: rows };
}

/** One watcher pass: a snapshot for each signed-up wallet that has none for today (oldest first). */
export async function snapshotDueWallets(): Promise<number> {
  const sql = await db();
  const today = isoDay(dayStart(new Date()));
  const wallets = await sql`
    select u.wallet from ${sql(T.users)} u
    left join lateral (
      select max(day) as last from ${sql(T.snapshots)} s where s.wallet = u.wallet
    ) s on true
    where s.last is null or s.last < ${today}
    order by s.last nulls first
    limit ${SNAPSHOTS_PER_RUN}`;
  const held: { wallet: string; positions: Position[]; usdcBalance: number }[] = [];
  for (const { wallet } of wallets) {
    try {
      held.push({ wallet: wallet as string, ...(await holdings(wallet as string)) });
    } catch (error) {
      console.error("[portfolio] snapshot holdings failed", wallet, error);
    }
  }
  if (held.length === 0) return 0;
  const prices = await livePrices(held.flatMap((h) => h.positions.map((p) => p.mint)));
  let written = 0;
  for (const { wallet, positions, usdcBalance } of held) {
    const valued = valueAt(positions, usdcBalance, prices);
    if (!valued) continue;
    const rows = await sql`
      insert into ${sql(T.snapshots)} (wallet, day, value, cost_basis, pnl, usdc, positions, source)
      values (${wallet}, ${today}, ${valued.value}, ${valued.costBasis}, ${valued.pnl},
              ${usdcBalance}, ${sql.json(valued.positions as never)}, 'snapshot')
      on conflict do nothing returning wallet`;
    written += rows.length;
  }
  return written;
}

/** Daily closes per mint (UTC day start → close); a mint whose series can't be read is left out. */
async function dailyCloses(mints: string[]) {
  const closes = new Map<string, Map<number, number>>();
  for (const mint of mints) {
    try {
      const candles = await stockCandles(mint, "1y");
      closes.set(mint, new Map(candles.map((c) => [dayStart(new Date(c.time * 1000)), c.close])));
    } catch (error) {
      console.error("[portfolio] backfill closes failed", mint, error);
    }
  }
  return closes;
}

/**
 * Rebuilds past days from the wallet's recorded fills (newest first) × daily
 * closes, from the first fill's day to yesterday, and stores them, so it's done
 * once. Holdings bought elsewhere and USDC aren't known for those days, so a
 * backfilled value covers recorded holdings only.
 */
async function backfill(wallet: string, fills: Fill[]): Promise<number> {
  if (fills.length === 0) return 0;
  const ordered = [...fills].reverse();
  const today = dayStart(new Date());
  const first = Math.max(
    dayStart(new Date(ordered[0]!.blockTime)),
    today - (PERIOD_DAYS["1y"] - 1) * DAY_S,
  );
  const closes = await dailyCloses([...new Set(ordered.map((f) => f.mint))]);
  const sql = await db();

  const books = new Map<string, { qty: number; cost: number }>();
  let next = 0;
  const rows: Record<string, unknown>[] = [];
  for (let day = first; day < today; day += DAY_S) {
    // Every fill up to the end of this day.
    while (next < ordered.length && Date.parse(ordered[next]!.blockTime) / 1000 < day + DAY_S) {
      const fill = ordered[next++]!;
      const book = books.get(fill.mint) ?? { qty: 0, cost: 0 };
      if (fill.side === "buy") {
        book.qty += fill.tokenAmount;
        book.cost += fill.usdcAmount;
      } else if (book.qty > 0) {
        const sold = Math.min(fill.tokenAmount, book.qty);
        book.cost -= (book.cost / book.qty) * sold;
        book.qty -= sold;
      }
      books.set(fill.mint, book);
    }
    let value = 0;
    let costBasis = 0;
    const positions: object[] = [];
    let priced = true;
    for (const [mint, { qty, cost }] of books) {
      if (qty <= 0) continue;
      const close = closes.get(mint)?.get(day);
      if (close == null) {
        priced = false;
        break;
      }
      value += qty * close;
      costBasis += cost;
      positions.push({ mint, amount: qty, price: close });
    }
    if (!priced) continue;
    rows.push({
      wallet,
      day: isoDay(day),
      value,
      cost_basis: costBasis,
      pnl: value - costBasis,
      usdc: null,
      positions: sql.json(positions as never),
      source: "backfill",
    });
  }
  if (rows.length === 0) return 0;
  const inserted = await sql`
    insert into ${sql(T.snapshots)} ${sql(rows as never, "wallet", "day", "value", "cost_basis", "pnl", "usdc", "positions", "source")}
    on conflict do nothing returning day`;
  return inserted.length;
}

export async function portfolioHistory(
  wallet: string,
  period: HistoryPeriod,
): Promise<PortfolioHistoryResponse> {
  const sql = await db();
  const [stored] = await sql`
    select count(*)::int as count from ${sql(T.snapshots)} where wallet = ${wallet}`;
  const held = await holdings(wallet);
  if (Number(stored?.count ?? 0) < 2) await backfill(wallet, held.fills);

  const today = dayStart(new Date());
  const since = isoDay(today - (PERIOD_DAYS[period] - 1) * DAY_S);
  const rows = await sql`
    select day, value, pnl, source from ${sql(T.snapshots)}
    where wallet = ${wallet} and day >= ${since} and day < ${isoDay(today)}
    order by day`;
  const points: PortfolioPoint[] = rows.map((r) => ({
    time: dayStart(r.day as Date),
    value: r.value as number,
    pnl: r.pnl as number,
    source: r.source as PortfolioPoint["source"],
  }));

  const live = valueAt(
    held.positions,
    held.usdcBalance,
    held.positions.length ? await livePrices(held.positions.map((p) => p.mint)) : {},
  );
  if (live) points.push({ time: today, value: live.value, pnl: live.pnl, source: "live" });

  return { points, backfilled: points.some((p) => p.source === "backfill") };
}

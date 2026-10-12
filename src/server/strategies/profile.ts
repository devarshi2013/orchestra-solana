import "server-only";

import type { Fill, Position, ProfileResponse } from "@/lib/strategies/types";
import { USDC_MINT } from "@/lib/tokens";
import { toUnits } from "@/lib/units";
import { db, T } from "@/server/db";
import { getWalletBalances } from "@/server/solana/rpc";
import { stockUniverse } from "@/server/stocks/universe";

import { listStrategies, toFill, toNotification } from "./store";

/**
 * Recorded quantity and cost per mint, average-cost method (sells take cost
 * out at the average). `fills` is newest first.
 */
function costByMint(fills: Fill[]) {
  const books = new Map<string, { qty: number; cost: number }>();
  for (const fill of [...fills].reverse()) {
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
  return books;
}

/** The wallet's listed stock tokens (with recorded cost), its USDC, and its recorded fills (newest first). */
export async function holdings(wallet: string) {
  const sql = await db();
  const [balances, { byMint }, fillRows] = await Promise.all([
    getWalletBalances(wallet),
    stockUniverse(),
    sql`select * from ${sql(T.fills)} where wallet = ${wallet} order by block_time desc`,
  ]);
  const fills = fillRows.map(toFill);
  const books = costByMint(fills);

  const positions: Position[] = Object.entries(balances).flatMap(([mint, balance]) => {
    const entry = byMint.get(mint);
    const tokenAmount = toUnits(balance.amount, balance.decimals);
    if (!entry || tokenAmount <= 0) return [];
    const book = books.get(mint);
    const avgCost = book && book.qty > 0 ? book.cost / book.qty : null;
    const recordedAmount = avgCost === null ? 0 : Math.min(tokenAmount, book!.qty);
    return [
      {
        mint,
        symbol: entry.token.symbol,
        ticker: entry.stock.ticker,
        name: entry.stock.name,
        icon: entry.token.icon,
        tokenAmount,
        avgCost,
        recordedAmount,
        costBasis: avgCost === null ? null : avgCost * recordedAmount,
      },
    ];
  });

  const usdc = balances[USDC_MINT];
  return { positions, fills, usdcBalance: usdc ? toUnits(usdc.amount, usdc.decimals) : 0 };
}

export async function profile(wallet: string): Promise<ProfileResponse> {
  const sql = await db();
  const [{ positions, fills, usdcBalance }, strategies, notificationRows, [user]] =
    await Promise.all([
      holdings(wallet),
      listStrategies(wallet),
      sql`select * from ${sql(T.notifications)} where wallet = ${wallet} order by created_at desc limit 50`,
      sql`select webhook_url from ${sql(T.users)} where wallet = ${wallet}`,
    ]);
  return {
    wallet,
    webhookUrl: (user?.webhook_url as string | null | undefined) ?? null,
    positions,
    strategies,
    fills: fills.slice(0, 50),
    notifications: notificationRows.map(toNotification),
    usdcBalance,
  };
}

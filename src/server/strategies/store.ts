import "server-only";

import type {
  Condition,
  Fill,
  Notification,
  Strategy,
  StrategyStatus,
} from "@/lib/strategies/types";
import { db, T } from "@/server/db";

/** Database rows → the contract types (src/lib/strategies/types.ts). */

type Row = Record<string, unknown>;
const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : null);
const num = (value: unknown) => (value == null ? null : Number(value));

export const toStrategy = (r: Row): Strategy => ({
  id: String(r.id),
  wallet: String(r.wallet),
  mint: String(r.mint),
  symbol: String(r.symbol),
  ticker: String(r.ticker),
  name: String(r.name),
  usdcAmount: Number(r.usdc_amount),
  condition: r.condition as Condition,
  repeat: Boolean(r.repeat),
  status: r.status as StrategyStatus,
  createdAt: iso(r.created_at)!,
  triggeredAt: iso(r.triggered_at),
  triggerValue: num(r.trigger_value),
  lastFillSignature: (r.last_fill_signature as string | null) ?? null,
});

export const toFill = (r: Row): Fill => ({
  signature: String(r.signature),
  wallet: String(r.wallet),
  strategyId: (r.strategy_id as string | null) ?? null,
  mint: String(r.mint),
  symbol: String(r.symbol),
  side: r.side as Fill["side"],
  usdcAmount: Number(r.usdc_amount),
  tokenAmount: Number(r.token_amount),
  price: Number(r.price),
  blockTime: iso(r.block_time)!,
});

export const toNotification = (r: Row): Notification => ({
  id: String(r.id),
  strategyId: (r.strategy_id as string | null) ?? null,
  kind: r.kind as Notification["kind"],
  title: String(r.title),
  body: String(r.body),
  createdAt: iso(r.created_at)!,
  readAt: iso(r.read_at),
});

export async function listStrategies(wallet: string): Promise<Strategy[]> {
  const sql = await db();
  const rows =
    await sql`select * from ${sql(T.strategies)} where wallet = ${wallet} and status <> 'cancelled' order by created_at desc`;
  return rows.map(toStrategy);
}

export async function addNotification(
  wallet: string,
  strategyId: string | null,
  kind: Notification["kind"],
  title: string,
  body: string,
) {
  const sql = await db();
  await sql`insert into ${sql(T.notifications)} (wallet, strategy_id, kind, title, body) values (${wallet}, ${strategyId}, ${kind}, ${title}, ${body})`;
}

export async function webhookUrl(wallet: string): Promise<string | null> {
  const sql = await db();
  const [row] = await sql`select webhook_url from ${sql(T.users)} where wallet = ${wallet}`;
  return (row?.webhook_url as string | null | undefined) ?? null;
}

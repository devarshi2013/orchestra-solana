import "server-only";

import type { Condition, Strategy } from "@/lib/strategies/types";
import { db, T } from "@/server/db";
import { snapshotDueWallets } from "@/server/portfolio/history";
import { livePrices } from "@/server/prices";

import { addNotification, toStrategy, webhookUrl } from "./store";

/**
 * One watcher pass: every watching strategy is checked against Jupiter's live
 * price; those whose condition holds become "triggered", the owner gets a
 * notification and, if they set one, a webhook POST. Buying stays with the
 * user: they open the app and sign. Each pass also writes the day's portfolio
 * snapshots that are due.
 */

const WEBHOOK_TIMEOUT_MS = 5_000;
const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 })}`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

type Quote = { price: number; change24h: number | null } | null;

/**
 * Whether `condition` holds, with the value that met it (the price or 24h
 * change; none for a schedule). Null when it doesn't hold or the figure it
 * needs is missing.
 */
function met(condition: Condition, quote: Quote, due: boolean): { value: number | null } | null {
  const hit = (ok: boolean, value: number) => (ok ? { value } : null);
  if (condition.type === "every") return due ? { value: null } : null;
  if (!quote) return null;
  const { price, change24h } = quote;
  switch (condition.type) {
    case "price_below":
      return hit(price <= condition.price, price);
    case "price_above":
      return hit(price >= condition.price, price);
    case "change_below":
      return change24h == null ? null : hit(change24h <= condition.pct, change24h);
    case "change_above":
      return change24h == null ? null : hit(change24h >= condition.pct, change24h);
  }
}

/** "NVDAx dropped to $219.40, below $220.00". */
function triggerText({ symbol, condition }: Strategy, value: number | null): string {
  switch (condition.type) {
    case "price_below":
      return `${symbol} dropped to ${usd(value!)}, below ${usd(condition.price)}`;
    case "price_above":
      return `${symbol} rose to ${usd(value!)}, above ${usd(condition.price)}`;
    case "change_below":
    case "change_above":
      return `${symbol} is ${pct(value!)} in 24h (trigger ${pct(condition.pct)})`;
    case "every":
      return `Your every-${condition.days}-day buy of ${symbol} is due`;
  }
}

async function postWebhook(url: string, payload: Record<string, unknown>) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!response.ok) console.error(`[strategies] webhook answered ${response.status}`);
  } catch (error) {
    console.error("[strategies] webhook failed", error instanceof Error ? error.message : error);
  }
}

/** Today's due portfolio snapshots; a failure is logged, never fails the watcher. */
async function snapshots(): Promise<number> {
  try {
    return await snapshotDueWallets();
  } catch (error) {
    console.error("[portfolio] snapshots failed", error);
    return 0;
  }
}

export async function runWatcher(origin: string) {
  const snapshotsWritten = await snapshots();
  const sql = await db();
  const strategies = (await sql`select * from ${sql(T.strategies)} where status = 'watching'`).map(
    (row) => ({
      strategy: toStrategy(row),
      due: row.next_run_at instanceof Date && row.next_run_at <= new Date(),
    }),
  );
  if (strategies.length === 0) return { checked: 0, triggered: [] as string[], snapshotsWritten };

  const prices = await livePrices(strategies.map(({ strategy }) => strategy.mint));
  const triggered: string[] = [];
  for (const { strategy, due } of strategies) {
    const quote = prices[strategy.mint] ?? null;
    const hit = met(strategy.condition, quote, due);
    if (!hit) continue;
    const { value } = hit;
    // Only one pass may trigger it (the status check guards against overlapping runs).
    const [row] = await sql`
      update ${sql(T.strategies)} set status = 'triggered', triggered_at = now(), trigger_value = ${value}
      where id = ${strategy.id} and status = 'watching' returning id`;
    if (!row) continue;
    triggered.push(strategy.id);

    const title = `Buy ${usd(strategy.usdcAmount)} of ${strategy.symbol}`;
    const body = `${triggerText(strategy, value)}. Open Tickertape to buy.`;
    await addNotification(strategy.wallet, strategy.id, "triggered", title, body);
    const hook = await webhookUrl(strategy.wallet);
    if (hook) {
      const url = `${origin}/portfolio?strategy=${strategy.id}`;
      const text = `${title}: ${body} ${url}`;
      await postWebhook(hook, {
        text,
        content: text,
        strategy: { ...strategy, status: "triggered" },
        price: quote,
        url,
      });
    }
  }
  return { checked: strategies.length, triggered, snapshotsWritten };
}

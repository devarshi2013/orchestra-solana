import "server-only";

import type { Condition, Fill } from "@/lib/strategies/types";
import { USDC_MINT } from "@/lib/tokens";
import { db, T } from "@/server/db";
import { getParsedTransaction } from "@/server/solana/rpc";
import { stockUniverse } from "@/server/stocks/universe";

import { addNotification, toFill } from "./store";

/**
 * Records a swap the user landed through the app, read back from the chain
 * (never from what the browser claims): the signer whose balances moved one
 * listed stock token one way and USDC the other. Idempotent per signature.
 */

export class FillError extends Error {}

type TokenBalance = {
  owner?: string;
  mint: string;
  uiTokenAmount: { amount: string; decimals: number };
};

/** Per-mint base-unit change for `owner` across the transaction, with each mint's decimals. */
function deltasFor(owner: string, pre: TokenBalance[], post: TokenBalance[]) {
  const deltas = new Map<string, { amount: bigint; decimals: number }>();
  const add = (b: TokenBalance, sign: 1n | -1n) => {
    if (b.owner !== owner) return;
    const prev = deltas.get(b.mint)?.amount ?? 0n;
    deltas.set(b.mint, {
      amount: prev + sign * BigInt(b.uiTokenAmount.amount),
      decimals: b.uiTokenAmount.decimals,
    });
  };
  post.forEach((b) => add(b, 1n));
  pre.forEach((b) => add(b, -1n));
  return deltas;
}

const units = ({ amount, decimals }: { amount: bigint; decimals: number }) =>
  Math.abs(Number(amount)) / 10 ** decimals;

export async function recordFill(signature: string, strategyId: string | null): Promise<Fill> {
  const sql = await db();
  const [existing] = await sql`select * from ${sql(T.fills)} where signature = ${signature}`;
  if (existing) return toFill(existing);

  const tx = await getParsedTransaction(signature);
  if (!tx?.meta || tx.meta.err) throw new FillError("Transaction not found or failed");
  const pre = (tx.meta.preTokenBalances ?? []) as TokenBalance[];
  const post = (tx.meta.postTokenBalances ?? []) as TokenBalance[];
  const { byMint } = await stockUniverse();

  const signers = tx.transaction.message.accountKeys
    .filter((key) => key.signer)
    .map((key) => key.pubkey.toBase58());
  for (const wallet of signers) {
    const deltas = deltasFor(wallet, pre, post);
    const usdc = deltas.get(USDC_MINT);
    const stocks = [...deltas].filter(([mint, d]) => byMint.has(mint) && d.amount !== 0n);
    if (!usdc || usdc.amount === 0n || stocks.length !== 1) continue;
    const [[mint, stock]] = stocks as [[string, { amount: bigint; decimals: number }]];
    if (stock.amount > 0n === usdc.amount > 0n) continue;

    const side = stock.amount > 0n ? "buy" : "sell";
    const usdcAmount = units(usdc);
    const tokenAmount = units(stock);
    const symbol = byMint.get(mint)!.token.symbol;
    if (tx.blockTime == null) throw new FillError("Transaction has no block time yet");
    const blockTime = new Date(tx.blockTime * 1000);

    const [owned] = strategyId
      ? await sql`select id, repeat, condition from ${sql(T.strategies)} where id = ${strategyId} and wallet = ${wallet} and mint = ${mint}`
      : [];
    const linked = (owned?.id as string | undefined) ?? null;
    const [row] = await sql`
      insert into ${sql(T.fills)} (signature, wallet, strategy_id, mint, symbol, side, usdc_amount, token_amount, price, block_time)
      values (${signature}, ${wallet}, ${linked}, ${mint}, ${symbol}, ${side}, ${usdcAmount}, ${tokenAmount}, ${usdcAmount / tokenAmount}, ${blockTime})
      on conflict (signature) do nothing returning *`;
    if (!row)
      return toFill((await sql`select * from ${sql(T.fills)} where signature = ${signature}`)[0]!);

    if (owned) {
      const condition = owned.condition as Condition;
      const next =
        condition.type === "every" ? new Date(Date.now() + condition.days * 86_400_000) : null;
      await sql`
        update ${sql(T.strategies)} set last_fill_signature = ${signature},
          status = ${owned.repeat ? "watching" : "filled"}, next_run_at = coalesce(${next}, next_run_at)
        where id = ${linked}`;
      await addNotification(
        wallet,
        linked,
        "filled",
        `Bought ${tokenAmount.toPrecision(6)} ${symbol}`,
        `${usdcAmount.toFixed(2)} USDC at ${(usdcAmount / tokenAmount).toFixed(2)} per ${symbol}.`,
      );
    }
    return toFill(row);
  }
  throw new FillError("Not a swap between USDC and a listed stock token");
}

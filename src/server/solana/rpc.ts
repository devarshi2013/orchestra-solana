import "server-only";

import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";

import { serverEnv } from "@/env/server";
import type { Balance } from "@/lib/units";
import { SOL_MINT } from "@/lib/tokens";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

let connection: Connection | null = null;
const rpc = () => (connection ??= new Connection(serverEnv.SOLANA_RPC_URL, "confirmed"));

type ParsedTokenAccount = {
  mint: string;
  tokenAmount: { amount: string; decimals: number };
};

/**
 * Every balance the wallet holds, in base units: native SOL under the wSOL
 * mint (Jupiter swaps native SOL for it), plus SPL and Token-2022 accounts.
 * Wrapped-SOL token accounts are ignored: Jupiter spends native SOL.
 */
export async function getWalletBalances(owner: string): Promise<Record<string, Balance>> {
  const key = new PublicKey(owner);
  const [lamports, classic, token2022] = await Promise.all([
    rpc().getBalance(key),
    rpc().getParsedTokenAccountsByOwner(key, { programId: TOKEN_PROGRAM }),
    rpc().getParsedTokenAccountsByOwner(key, { programId: TOKEN_2022_PROGRAM }),
  ]);
  const balances: Record<string, Balance> = {};
  for (const { account } of [...classic.value, ...token2022.value]) {
    const info = (account.data as { parsed: { info: ParsedTokenAccount } }).parsed.info;
    if (info.mint === SOL_MINT) continue;
    const previous = balances[info.mint];
    balances[info.mint] = {
      amount: (BigInt(previous?.amount ?? "0") + BigInt(info.tokenAmount.amount)).toString(),
      decimals: info.tokenAmount.decimals,
    };
  }
  balances[SOL_MINT] = { amount: String(lamports), decimals: 9 };
  return balances;
}

export type TransactionOutcome =
  | { status: "succeeded"; transaction: ParsedTransactionWithMeta }
  | { status: "failed"; error: string }
  | { status: "unknown" };

/** Whether a signature landed, and its parsed transaction if it did. */
export async function getTransactionOutcome(signature: string): Promise<TransactionOutcome> {
  const transaction = await rpc().getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!transaction?.meta) return { status: "unknown" };
  if (transaction.meta.err)
    return { status: "failed", error: JSON.stringify(transaction.meta.err) };
  return { status: "succeeded", transaction };
}

/**
 * How much of each mint left and entered `owner`'s wallet in a transaction,
 * from its pre/post balances (base units). Native SOL counts for the wSOL mint.
 */
export function walletDeltas(
  transaction: ParsedTransactionWithMeta,
  owner: string,
): Record<string, bigint> {
  const meta = transaction.meta!;
  const deltas: Record<string, bigint> = {};
  const add = (mint: string, amount: bigint) => (deltas[mint] = (deltas[mint] ?? 0n) + amount);
  for (const balance of meta.postTokenBalances ?? []) {
    if (balance.owner === owner) add(balance.mint, BigInt(balance.uiTokenAmount.amount));
  }
  for (const balance of meta.preTokenBalances ?? []) {
    if (balance.owner === owner) add(balance.mint, -BigInt(balance.uiTokenAmount.amount));
  }
  const index = transaction.transaction.message.accountKeys.findIndex(
    (key) => key.pubkey.toBase58() === owner,
  );
  if (index >= 0) {
    add(SOL_MINT, BigInt(meta.postBalances[index]!) - BigInt(meta.preBalances[index]!));
  }
  return deltas;
}

/** The current block height, for checking whether an order can still land. */
export function getBlockHeight(): Promise<number> {
  return rpc().getBlockHeight("confirmed");
}

const decimalsCache = new Map<string, number>();

/** A mint's decimals (cached; they never change). */
export async function getMintDecimals(mint: string): Promise<number> {
  const cached = decimalsCache.get(mint);
  if (cached !== undefined) return cached;
  const info = await rpc().getParsedAccountInfo(new PublicKey(mint));
  const decimals = (info.value?.data as { parsed?: { info?: { decimals?: number } } } | undefined)
    ?.parsed?.info?.decimals;
  if (typeof decimals !== "number") throw new Error(`Not a token mint: ${mint}`);
  decimalsCache.set(mint, decimals);
  return decimals;
}

import "server-only";

import { Connection, PublicKey } from "@solana/web3.js";

import { serverEnv } from "@/env";
import type { Balance } from "@/lib/units";
import { cached } from "@/server/cache";
import { SOL_MINT } from "@/lib/tokens";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

let connection: Connection | null = null;
// web3.js retries rate-limited calls with backoff by default; a 429 surfaces at once instead.
const rpc = () =>
  (connection ??= new Connection(serverEnv.SOLANA_RPC_URL, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  }));

/** How long one balance read is shared (the profile, its history and the share card read together). */
const BALANCES_TTL_MS = 5_000;

type ParsedTokenAccount = {
  mint: string;
  tokenAmount: { amount: string; decimals: number };
};

/**
 * Every balance the wallet holds, in base units: native SOL under the wSOL
 * mint (Jupiter swaps native SOL for it), plus SPL and Token-2022 accounts.
 * Wrapped-SOL token accounts are ignored: Jupiter spends native SOL.
 */
export const getWalletBalances = (owner: string): Promise<Record<string, Balance>> =>
  cached(`balances:${owner}`, BALANCES_TTL_MS, () => readBalances(owner));

async function readBalances(owner: string): Promise<Record<string, Balance>> {
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

/** A confirmed transaction with parsed accounts and token balances, or null when it isn't found. */
export const getParsedTransaction = (signature: string) =>
  rpc().getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

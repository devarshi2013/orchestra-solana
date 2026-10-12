import "server-only";

import { randomBytes, webcrypto } from "node:crypto";

import bs58 from "bs58";

import { db, T } from "@/server/db";

/**
 * Sign-In With Solana: the server issues a single-use nonce, bound to the
 * wallet, inside a message in the SIWS format (wallets like Phantom refuse to
 * show a sign-in message that doesn't follow it), the wallet signs it, and the
 * server checks the ed25519 signature against the wallet's public key.
 */

const NONCE_TTL_MS = 10 * 60_000;

export async function createSignInMessage({
  host,
  origin,
  wallet,
}: {
  host: string;
  origin: string;
  wallet: string;
}) {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);
  const sql = await db();
  await sql`delete from ${sql(T.authNonces)} where expires_at < now()`;
  await sql`insert into ${sql(T.authNonces)} (nonce, wallet, expires_at) values (${nonce}, ${wallet}, ${expiresAt})`;
  const message = [
    `${host} wants you to sign in with your Solana account:`,
    wallet,
    "",
    "Sign in to Tickertape",
    "",
    `URI: ${origin}`,
    "Version: 1",
    "Chain ID: mainnet",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
  ].join("\n");
  return { nonce, message };
}

/** Whether `signature` (base58) is `wallet`'s signature of `message`, which carries a live nonce for `host`. */
export async function verifySignIn({
  wallet,
  signature,
  message,
  host,
}: {
  wallet: string;
  signature: string;
  message: string;
  host: string;
}): Promise<boolean> {
  const nonce = /^Nonce: ([0-9a-f]{32})$/m.exec(message)?.[1];
  const header = `${host} wants you to sign in with your Solana account:\n${wallet}\n`;
  if (!nonce || !message.startsWith(header)) return false;
  const sql = await db();
  // Single use: the nonce is consumed whether or not the signature checks out.
  const [row] =
    await sql`delete from ${sql(T.authNonces)} where nonce = ${nonce} and wallet = ${wallet} and expires_at > now() returning nonce`;
  if (!row) return false;
  try {
    const key = await webcrypto.subtle.importKey("raw", bs58.decode(wallet), "Ed25519", false, [
      "verify",
    ]);
    return await webcrypto.subtle.verify(
      "Ed25519",
      key,
      bs58.decode(signature),
      new TextEncoder().encode(message),
    );
  } catch {
    return false;
  }
}

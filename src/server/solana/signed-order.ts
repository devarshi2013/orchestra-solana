import "server-only";

import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

import { base64ToBytes } from "@/lib/solana";
import { verifyWalletSignature } from "@/server/auth/session";

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

/**
 * Checks a wallet-signed transaction before we send it on: it must be exactly
 * the order Jupiter quoted (same message bytes), and `owner` must have signed
 * it with a valid signature. Returns the transaction signature when the
 * owner pays fees (it's then known before sending), for reconciliation.
 */
export function checkSignedOrder(
  orderTransaction: string,
  signedTransaction: string,
  owner: string,
): { ok: true; signature: string | null } | { ok: false; reason: string } {
  let order: VersionedTransaction;
  let signed: VersionedTransaction;
  try {
    order = VersionedTransaction.deserialize(base64ToBytes(orderTransaction));
    signed = VersionedTransaction.deserialize(base64ToBytes(signedTransaction));
  } catch {
    return { ok: false, reason: "Couldn't decode the signed transaction" };
  }
  const message = signed.message.serialize();
  if (!sameBytes(message, order.message.serialize())) {
    return { ok: false, reason: "The signed transaction isn't the quoted order" };
  }
  const signerKeys = signed.message.staticAccountKeys.slice(
    0,
    signed.message.header.numRequiredSignatures,
  );
  const index = signerKeys.findIndex((key) => key.toBase58() === owner);
  const ownerSignature = index >= 0 ? signed.signatures[index] : undefined;
  if (!ownerSignature || !verifyWalletSignature(owner, message, ownerSignature)) {
    return { ok: false, reason: "The transaction isn't signed by this wallet" };
  }
  const first = signed.signatures[0]!;
  return { ok: true, signature: first.some((b) => b !== 0) ? bs58.encode(first) : null };
}

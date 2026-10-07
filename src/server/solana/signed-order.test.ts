import type { PublicKey } from "@solana/web3.js";
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { bytesToBase64 } from "@/lib/solana";

import { checkSignedOrder } from "./signed-order";

const owner = Keypair.generate();
const maker = Keypair.generate();
const blockhash = bs58.encode(new Uint8Array(32).fill(7));

/** An unsigned v0 transaction like Jupiter's order; `payer` pays fees. */
function order(payer: PublicKey, lamports = 1000) {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: maker.publicKey, lamports }),
    ],
  }).compileToV0Message();
  return new VersionedTransaction(message);
}
const b64 = (tx: VersionedTransaction) => bytesToBase64(tx.serialize());

describe("checkSignedOrder", () => {
  it("accepts the quoted order signed by the owner, returning its signature", () => {
    const unsigned = order(owner.publicKey);
    const signed = order(owner.publicKey);
    signed.sign([owner]);
    expect(checkSignedOrder(b64(unsigned), b64(signed), owner.publicKey.toBase58())).toEqual({
      ok: true,
      signature: bs58.encode(signed.signatures[0]!),
    });
  });

  it("accepts an RFQ-style order whose fee payer signs later, without a signature yet", () => {
    const unsigned = order(maker.publicKey);
    const signed = order(maker.publicKey);
    signed.sign([owner]); // owner signs its slot; the maker's is added at /execute
    expect(checkSignedOrder(b64(unsigned), b64(signed), owner.publicKey.toBase58())).toEqual({
      ok: true,
      signature: null,
    });
  });

  it("rejects a different transaction, a missing or wrong signature, and junk", () => {
    const unsigned = order(owner.publicKey);
    const other = order(owner.publicKey, 999_999);
    other.sign([owner]);
    expect(checkSignedOrder(b64(unsigned), b64(other), owner.publicKey.toBase58())).toEqual({
      ok: false,
      reason: "The signed transaction isn't the quoted order",
    });
    expect(
      checkSignedOrder(b64(unsigned), b64(order(owner.publicKey)), owner.publicKey.toBase58()),
    ).toMatchObject({
      ok: false,
      reason: "The transaction isn't signed by this wallet",
    });
    const signed = order(owner.publicKey);
    signed.sign([owner]);
    expect(checkSignedOrder(b64(unsigned), b64(signed), maker.publicKey.toBase58())).toMatchObject({
      ok: false,
    });
    expect(checkSignedOrder(b64(unsigned), "AAAA", owner.publicKey.toBase58())).toMatchObject({
      ok: false,
      reason: "Couldn't decode the signed transaction",
    });
  });
});

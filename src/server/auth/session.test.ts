import { createPrivateKey, sign } from "node:crypto";

import { Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { buildSignInMessage } from "@/lib/auth/siws";

import { readToken, signToken, verifyWalletSignature } from "./session";

const KEY = "k".repeat(32);

/** Signs like a wallet's signMessage: raw ed25519 over the message bytes. */
function walletSign(keypair: Keypair, message: string): Uint8Array {
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(keypair.secretKey.slice(0, 32)),
  ]);
  return sign(
    null,
    Buffer.from(message),
    createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }),
  );
}

describe("session tokens", () => {
  it("round-trips an unexpired payload", () => {
    const token = signToken({ sub: "wallet", exp: 2_000 }, KEY);
    expect(readToken(token, 1_000_000, KEY)).toEqual({ sub: "wallet", exp: 2_000 });
  });

  it("rejects expired, tampered, foreign and malformed tokens", () => {
    const token = signToken({ sub: "wallet", exp: 2_000 }, KEY);
    expect(readToken(token, 2_000_000, KEY)).toBeNull();
    const [body, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "attacker", exp: 9e9 })).toString("base64url");
    expect(readToken(`${forged}.${mac}`, 0, KEY)).toBeNull();
    expect(readToken(token, 0, "x".repeat(32))).toBeNull();
    expect(readToken(`${body}`, 0, KEY)).toBeNull();
    expect(readToken(undefined, 0, KEY)).toBeNull();
    expect(readToken(`${b64("not json")}.${signToken({}, KEY).split(".")[1]}`, 0, KEY)).toBeNull();
  });
});

const b64 = (s: string) => Buffer.from(s).toString("base64url");

describe("verifyWalletSignature", () => {
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();
  const message = buildSignInMessage({
    domain: "localhost:3000",
    address,
    nonce: "abc",
    issuedAt: new Date("2026-10-07T00:00:00Z"),
    expiresAt: new Date("2026-10-07T00:10:00Z"),
  });

  it("accepts the wallet's own signature of the message", () => {
    expect(verifyWalletSignature(address, message, walletSign(keypair, message))).toBe(true);
  });

  it("rejects another message, another wallet, or junk", () => {
    const signature = walletSign(keypair, message);
    expect(verifyWalletSignature(address, `${message}!`, signature)).toBe(false);
    expect(verifyWalletSignature(Keypair.generate().publicKey.toBase58(), message, signature)).toBe(
      false,
    );
    expect(verifyWalletSignature("not-a-key", message, signature)).toBe(false);
    expect(verifyWalletSignature(address, message, new Uint8Array(10))).toBe(false);
  });

  it("builds a message that says it moves no funds", () => {
    expect(message).toContain("does not move funds");
    expect(message.split("\n")[1]).toBe(address);
  });
});

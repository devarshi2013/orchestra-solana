import { describe, expect, it } from "vitest";

import { base64ToBytes, bytesToBase64, solscanTxUrl } from "./solana";

describe("base64 helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array(Array.from({ length: 256 }, (_, i) => i));
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("matches Node's encoding", () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251]);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});

describe("solscanTxUrl", () => {
  it("adds the cluster param only for devnet", () => {
    expect(solscanTxUrl("sig", "mainnet-beta")).toBe("https://solscan.io/tx/sig");
    expect(solscanTxUrl("sig", "devnet")).toBe("https://solscan.io/tx/sig?cluster=devnet");
  });
});

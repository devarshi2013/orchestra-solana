/** Browser-safe base64 helpers (no Node Buffer in client bundles). */
export const base64ToBytes = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

/** Spreads the bytes as arguments: fine for transactions (at most 1232 bytes). */
export const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export const solscanTxUrl = (signature: string, cluster: "mainnet-beta" | "devnet") =>
  `https://solscan.io/tx/${signature}${cluster === "devnet" ? "?cluster=devnet" : ""}`;

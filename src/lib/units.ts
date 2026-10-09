/**
 * Token amounts: base units (integers, as on-chain) ↔ whole-token units, and
 * the order-size floor the assistant's plans respect.
 */

/**
 * Smallest buy we send. Jupiter documents no hard minimum except gasless
 * orders (~$10 when the wallet holds < 0.01 SOL); below that, fees and price
 * impact eat the trade anyway.
 */
export const MIN_ORDER_USD = 10;
export const USDC_DECIMALS = 6;

export type Balance = { amount: string; decimals: number };

export function toUnits(amount: string | bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

/** Whole-token units → base units, rounded down so we never ask for more than we have. */
export function toBaseUnits(units: number, decimals: number): bigint {
  if (!(units > 0)) return 0n;
  const [whole = "0", fraction = ""] = units.toFixed(decimals).split(".");
  const base = BigInt(whole + fraction.padEnd(decimals, "0").slice(0, decimals));
  // toFixed rounds half up; step back one unit if that overshot.
  return Number(base) / 10 ** decimals > units ? base - 1n : base;
}

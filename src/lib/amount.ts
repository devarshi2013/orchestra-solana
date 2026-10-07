/**
 * Convert a user-typed decimal string ("1.5") to integer base units (1500000n
 * for 6 decimals). Returns null for anything that is not a plain non-negative
 * decimal or that has more fractional digits than the token supports.
 */
export function parseAmountToBaseUnits(input: string, decimals: number): bigint | null {
  const value = input.trim();
  if (value === "" || value === "." || !/^\d*\.?\d*$/.test(value)) return null;
  const [whole = "", fraction = ""] = value.split(".");
  if (fraction.length > decimals) return null;
  return BigInt(`${whole || "0"}${fraction.padEnd(decimals, "0")}`);
}

/** Format integer base units as a human-readable decimal string. */
export function formatBaseUnits(
  amount: string | bigint,
  decimals: number,
  maxFractionDigits = 6,
): string {
  const value = BigInt(amount);
  const base = 10n ** BigInt(decimals);
  const whole = (value / base).toLocaleString("en-US");
  const fraction = (value % base)
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/** Base units → floating point, for display-only math (rates, USD). */
export function baseUnitsToNumber(amount: string | bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

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

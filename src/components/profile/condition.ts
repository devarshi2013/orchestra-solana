import { formatPrice } from "@/components/market/format";
import type { Condition, Strategy } from "@/lib/strategies/types";

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const WHEN: { [T in Condition["type"]]: (c: Extract<Condition, { type: T }>) => string } = {
  price_below: (c) => `when price < ${formatPrice(c.price)}`,
  price_above: (c) => `when price > ${formatPrice(c.price)}`,
  change_below: (c) => `when down ${Math.abs(c.pct)}% in 24h`,
  change_above: (c) => `when up ${c.pct}% in 24h`,
  every: (c) => (c.days === 1 ? "every day" : `every ${c.days} days`),
};

/** "when price < $220.00", "every 7 days". */
const describeCondition = (c: Condition) => (WHEN[c.type] as (c: Condition) => string)(c);

/** "Buy $190 of NVDAx when price < $220.00". */
export const describeStrategy = (s: Pick<Strategy, "usdcAmount" | "symbol" | "condition">) =>
  `Buy ${usd(s.usdcAmount)} of ${s.symbol} ${describeCondition(s.condition)}`;

/** What triggered it, in the condition's own unit. */
export function describeTrigger({ condition, triggerValue }: Strategy) {
  if (triggerValue == null) return null;
  if (condition.type === "price_below" || condition.type === "price_above") {
    return `at ${formatPrice(triggerValue)}`;
  }
  if (condition.type === "every") return null;
  return `at ${triggerValue > 0 ? "+" : ""}${triggerValue.toFixed(2)}%`;
}

/** The form's condition kinds: label, the number's label and unit, and how it becomes a condition. */
export const CONDITION_KINDS = {
  price_below: { label: "Below", field: "Price", unit: "USD", make: (n: number) => n },
  price_above: { label: "Above", field: "Price", unit: "USD", make: (n: number) => n },
  change_below: { label: "Drop", field: "24h drop", unit: "%", make: (n: number) => -n },
  change_above: { label: "Rise", field: "24h rise", unit: "%", make: (n: number) => n },
  every: { label: "Every", field: "Every", unit: "days", make: (n: number) => n },
} as const;

export type ConditionKind = keyof typeof CONDITION_KINDS;

export function toCondition(kind: ConditionKind, value: number): Condition {
  const n = CONDITION_KINDS[kind].make(value);
  switch (kind) {
    case "price_below":
    case "price_above":
      return { type: kind, price: n };
    case "change_below":
    case "change_above":
      return { type: kind, pct: n };
    case "every":
      return { type: kind, days: n };
  }
}

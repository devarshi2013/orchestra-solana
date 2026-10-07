"use client";

import { controlClass } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { IndicatorFn, IndicatorSpec } from "@/lib/indicators/types";
import { cn } from "@/lib/utils";

import { isPositiveInt, NumberField } from "./number-field";

/** For plain <select>s elsewhere; the editor uses <NativeSelect>. */
export const selectClass = cn(controlClass, "h-8 w-auto px-2.5");

const OPTIONS: { fn: IndicatorFn; label: string; unit: string }[] = [
  { fn: "price", label: "Price", unit: "USD" },
  { fn: "sma", label: "SMA", unit: "USD" },
  { fn: "ema", label: "EMA", unit: "USD" },
  { fn: "rsi", label: "RSI", unit: "0–100" },
  { fn: "cumulativeReturn", label: "Cumulative return", unit: "%" },
  { fn: "maxDrawdown", label: "Max drawdown", unit: "%" },
  { fn: "stdevReturn", label: "Stdev of returns", unit: "%" },
];

export const unitOf = (spec: IndicatorSpec) => OPTIONS.find((o) => o.fn === spec.fn)!.unit;

const DEFAULT_PERIOD: Record<Exclude<IndicatorFn, "price">, number> = {
  sma: 50,
  ema: 20,
  rsi: 14,
  cumulativeReturn: 30,
  maxDrawdown: 30,
  stdevReturn: 30,
};

/** Indicator dropdown plus a period (days) field when the indicator has one. */
export function IndicatorSelect({
  value,
  onChange,
  label,
}: {
  value: IndicatorSpec;
  onChange: (spec: IndicatorSpec) => void;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <NativeSelect
        size="sm"
        aria-label={label}
        value={value.fn}
        onChange={(e) => {
          const fn = e.target.value as IndicatorFn;
          if (fn === "price") return onChange({ fn });
          onChange({ fn, period: value.fn === "price" ? DEFAULT_PERIOD[fn] : value.period });
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.fn} value={o.fn}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      {value.fn !== "price" && (
        <>
          <NumberField
            aria-label={`${label} period in days`}
            value={value.period}
            min={1}
            step={1}
            isValid={isPositiveInt}
            className="w-16"
            onCommit={(period) => onChange({ ...value, period })}
          />
          <span className="text-xs text-muted-foreground">d</span>
        </>
      )}
    </span>
  );
}

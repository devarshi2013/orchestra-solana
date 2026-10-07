"use client";

import type { AssetIndicator, Comparator, Condition } from "@/lib/symphony/types";

import { NativeSelect } from "@/components/ui/native-select";

import { IndicatorSelect, unitOf } from "./indicator-select";
import { NumberField } from "./number-field";
import { TokenChip } from "./token-chip";

const COMPARATORS: { value: Comparator; label: string }[] = [
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
];

function IndicatorOf({
  value,
  onChange,
  side,
}: {
  value: AssetIndicator;
  onChange: (value: AssetIndicator) => void;
  side: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <IndicatorSelect
        label={`${side} indicator`}
        value={value.indicator}
        onChange={(indicator) => onChange({ ...value, indicator })}
      />
      <span className="text-xs text-muted-foreground">of</span>
      <TokenChip
        label={`${side} token`}
        mint={value.mint}
        onChange={(token) => onChange({ ...value, mint: token.mint })}
      />
    </span>
  );
}

/** "[indicator] of [token] [op] [number | indicator of token]" built from dropdowns. */
export function ConditionBuilder({
  value,
  onChange,
}: {
  value: Condition;
  onChange: (value: Condition) => void;
}) {
  const { left, right, comparator } = value;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-raised p-3 text-sm">
      <IndicatorOf
        side="Left"
        value={left}
        onChange={(next) => onChange({ ...value, left: next })}
      />
      <NativeSelect
        size="sm"
        aria-label="Comparison"
        value={comparator}
        onChange={(e) => onChange({ ...value, comparator: e.target.value as Comparator })}
      >
        {COMPARATORS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        size="sm"
        aria-label="Compare against"
        value={typeof right === "number" ? "value" : "indicator"}
        onChange={(e) =>
          onChange({
            ...value,
            right: e.target.value === "value" ? 0 : { mint: left.mint, indicator: { fn: "price" } },
          })
        }
      >
        <option value="value">a value</option>
        <option value="indicator">an indicator</option>
      </NativeSelect>
      {typeof right === "number" ? (
        <span className="inline-flex items-center gap-1">
          <NumberField
            aria-label="Value"
            value={right}
            step="any"
            className="w-24"
            onCommit={(next) => onChange({ ...value, right: next })}
          />
          <span className="text-xs text-muted-foreground">{unitOf(left.indicator)}</span>
        </span>
      ) : (
        <IndicatorOf
          side="Right"
          value={right}
          onChange={(next) => onChange({ ...value, right: next })}
        />
      )}
    </div>
  );
}

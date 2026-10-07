"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A number input that keeps whatever the user is typing locally and only
 * commits values that pass `isValid`, so the tree never holds NaN or "".
 */
export function NumberField({
  value,
  onCommit,
  isValid = Number.isFinite,
  className,
  ...props
}: {
  value: number;
  onCommit: (value: number) => void;
  isValid?: (value: number) => boolean;
  className?: string;
  "aria-label": string;
  min?: number;
  step?: number | "any";
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? String(value);
  const invalid = text !== null && !isValid(Number(text));
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={shown}
      aria-invalid={invalid || undefined}
      className={cn("h-8 w-20 rounded-md px-2.5 text-[0.8125rem] tabular-nums", className)}
      onChange={(e) => {
        setText(e.target.value);
        const next = Number(e.target.value);
        if (e.target.value.trim() !== "" && isValid(next)) onCommit(next);
      }}
      onBlur={() => setText(null)}
      {...props}
    />
  );
}

export const isPositiveInt = (v: number) => Number.isInteger(v) && v > 0;

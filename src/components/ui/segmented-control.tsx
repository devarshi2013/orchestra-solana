"use client";

import { motion } from "framer-motion";
import { cn } from "cn";
import { useId, type ReactNode } from "react";

export type SegmentedItem<V extends string> = { value: V; label: ReactNode; icon?: ReactNode };

/**
 * tokens.xyz's segmented control (their tabs and filters): a gray track with a
 * white pill that springs to the selected item.
 */
export function SegmentedControl<V extends string>({
  items,
  value,
  onValueChange,
  className,
  disabled,
  "aria-label": ariaLabel,
}: {
  items: readonly SegmentedItem<V>[];
  value: V;
  onValueChange: (value: V) => void;
  className?: string;
  disabled?: boolean;
  "aria-label": string;
}) {
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-slot="segmented-control"
      className={cn("inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-0.5", className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-[5px] rounded-full px-3 py-2 text-[length:var(--text-button-sm)] leading-none font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-gray-1200 focus-visible:ring-offset-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "text-text-extra-high" : "text-text-low hover:text-text-medium",
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                data-slot="segmented-control-pill"
                className="absolute inset-0 rounded-full bg-white shadow-[0px_1px_3px_rgba(0,0,0,0.07)]"
                transition={{ type: "spring", duration: 0.25, bounce: 0 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-[5px]">
              {item.icon && <span className="inline-flex size-4 items-center">{item.icon}</span>}
              <span>{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

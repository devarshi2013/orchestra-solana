import * as React from "react";
import { cn } from "cn";

/** Shared look of every text-like control: inputs, textareas and selects. */
export const controlClass =
  "w-full min-w-0 rounded-lg border border-input bg-surface text-sm text-foreground shadow-xs transition-[border-color,box-shadow,background-color] duration-150 outline-none placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-white/[0.03]";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        controlClass,
        "h-9 px-3 py-1 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

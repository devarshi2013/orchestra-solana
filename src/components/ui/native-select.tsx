import * as React from "react";
import { cn } from "cn";
import { ChevronDown } from "lucide-react";

import { controlClass } from "./input";

/**
 * A styled native <select>: keyboard, screen-reader and mobile pickers come
 * for free. `size="sm"` fits inline in editor rows.
 */
function NativeSelect({
  className,
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
  return (
    <span data-slot="native-select" className={cn("relative inline-flex", className)}>
      <select
        className={cn(
          controlClass,
          "cursor-pointer appearance-none pr-8",
          size === "sm" ? "h-8 rounded-md pl-2.5 text-[0.8125rem]" : "h-9 pl-3",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}

export { NativeSelect };

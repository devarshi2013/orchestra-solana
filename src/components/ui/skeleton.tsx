import type { ComponentProps } from "react";
import { cn } from "cn";

/** A loading placeholder: a softly pulsing gray block (still under reduced motion). */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };

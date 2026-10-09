import { cn } from "cn";

/** A loading placeholder with a soft shimmer (still under reduced motion). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--primary-tint)_0%,var(--surface-raised)_50%,var(--primary-tint)_100%)] bg-[length:200%_100%] opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };

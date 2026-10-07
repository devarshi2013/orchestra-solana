import { cn } from "cn";

/** A loading placeholder with a soft shimmer (still under reduced motion). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--muted)_0%,var(--surface-raised)_50%,var(--muted)_100%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };

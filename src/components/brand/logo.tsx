import { cn } from "@/lib/utils";

/**
 * The Askfirst mark: a chat bubble holding a check mark, "ask, then approve".
 * One path set shared by the UI, favicon (src/app/icon.svg), app icon and OG
 * image, so they always match.
 */
export const BUBBLE_PATH =
  "M9 3H23A7 7 0 0 1 30 10V17.5A7 7 0 0 1 23 24.5H14.5L8.5 29.2V24.3A7 7 0 0 1 2 17.5V10A7 7 0 0 1 9 3Z";
export const CHECK_PATH = "M10.5 14L14.4 17.7L21.8 10.4";

/** Icon only. Orange bubble, ink check (ink on orange is 6:1). */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={BUBBLE_PATH} className="fill-primary" />
      <path
        d={CHECK_PATH}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}

/** Mark + name, for the header and footer. */
export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-7", markClassName)} />
      <span className="font-heading text-[1.0625rem] font-semibold tracking-[-0.02em]">
        Askfirst
      </span>
    </span>
  );
}

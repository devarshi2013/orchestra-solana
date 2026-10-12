import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-gray-1200 focus-visible:ring-offset-2";

/** A round icon-only button on a soft fill (its aria-label names it). */
export function IconButton({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-[background-color,color,box-shadow] duration-150 hover:bg-soft hover:text-text-extra-high disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        FOCUS,
        className,
      )}
      {...props}
    />
  );
}

/** A pill button: soft fill that turns white and lifts on hover, or solid ink when `dark`. */
export function SoftButton({
  className,
  dark = false,
  type = "button",
  ...props
}: ComponentProps<"button"> & { dark?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        dark
          ? "bg-gray-1400 text-white hover:bg-gray-1300"
          : "bg-soft text-text-extra-high hover:bg-white hover:shadow-hairline",
        FOCUS,
        className,
      )}
      {...props}
    />
  );
}

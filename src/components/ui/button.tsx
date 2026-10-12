import { Children, isValidElement, type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";

/** tokens.xyz buttons: pills that press to 0.98; the primary one is solid ink. */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-gray-1200 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-status-error-border motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-gray-1400 text-white hover:bg-gray-1300 active:bg-gray-1100",
        secondary:
          "bg-gray-1400/8 text-text-extra-high hover:bg-gray-1400/12 active:bg-gray-1400/16 aria-expanded:bg-gray-1400/12",
        outline:
          "border-border-light bg-white text-text-extra-high shadow-[0_1px_2px_rgba(20,20,21,0.08)] hover:border-border-medium hover:bg-gray-50 aria-expanded:bg-gray-50",
        ghost:
          "text-text-medium hover:bg-gray-50 hover:text-text-extra-high aria-expanded:bg-gray-50 aria-expanded:text-text-extra-high",
        destructive:
          "bg-status-error-bg text-status-error-text hover:bg-status-error-bg/70 focus-visible:ring-status-error-border",
        link: "h-auto! rounded-none px-0! font-medium text-text-extra-high underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 gap-2 px-3.5 text-[length:var(--text-button-md)] leading-none",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[length:var(--text-button-sm)] leading-none [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 text-[length:var(--text-button-xl)] leading-none",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * `loading` swaps the leading icon for a spinner and disables the button
 * (not with `asChild`, where the child owns its content).
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const content =
    loading && !asChild ? (
      <>
        <Loader2 className="animate-spin" aria-hidden />
        {Children.toArray(children).filter(
          (child) => !(isValidElement(child) && typeof child.type !== "string"),
        )}
      </>
    ) : (
      children
    );

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={asChild ? disabled : disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {content}
    </Comp>
  );
}

export { Button };

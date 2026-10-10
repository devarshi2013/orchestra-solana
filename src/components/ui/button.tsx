import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,translate] duration-300 ease-in-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Navy with white text; lightens, lifts 2px and gains a soft shadow on hover. */
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover hover:shadow-hover motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0",
        /** Secondary: white with a navy border and text; fills navy on hover. */
        outline:
          "border-primary bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground hover:shadow-hover motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 aria-expanded:bg-primary aria-expanded:text-primary-foreground",
        secondary:
          "border-primary bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground hover:shadow-hover motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 aria-expanded:bg-primary aria-expanded:text-primary-foreground",
        /** Icon and toolbar buttons: navy, filling navy on hover (no lift). */
        ghost:
          "text-primary-text hover:bg-primary hover:text-primary-foreground aria-expanded:bg-primary aria-expanded:text-primary-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/60 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "h-auto! px-0! text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 rounded-xl px-7 text-[0.9375rem]",
        icon: "size-9",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-md",
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
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const content =
    loading && !asChild ? (
      <>
        <Loader2 className="animate-spin" aria-hidden />
        {React.Children.toArray(children).filter(
          (child) => !(React.isValidElement(child) && typeof child.type !== "string"),
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

export { Button, buttonVariants };

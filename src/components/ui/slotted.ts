import { createElement, type ComponentProps, type ElementType } from "react";
import { cn } from "cn";

/**
 * A shadcn part that only tags `Comp` with its `data-slot` and, given `base`,
 * merges the base classes with the caller's className.
 */
export function slotted<T extends ElementType>(Comp: T, slot: string, base?: string) {
  const Slotted = ({ className, ...props }: ComponentProps<T> & { className?: string }) =>
    createElement(Comp as ElementType, {
      "data-slot": slot,
      className: base === undefined ? className : cn(base, className),
      ...props,
    });
  Slotted.displayName = `Slotted(${slot})`;
  return Slotted;
}

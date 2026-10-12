"use client";

import { Command as CommandPrimitive } from "cmdk";
import { cn } from "cn";
import { Search } from "lucide-react";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { Drawer } from "vaul";

const DESKTOP = "(min-width: 768px)";
const subscribeDesktop = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
/** True from 768px up (false while server rendering). */
const useIsDesktop = () =>
  useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );

const COMMAND_CLASS =
  "flex h-full w-full flex-col overflow-hidden bg-white text-text-extra-high [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-low [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3";

/**
 * tokens.xyz's search palette: a dialog on desktop, a bottom drawer on phones.
 * Filtering is off: callers pass the results they want shown.
 */
export function CommandDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  const body = (
    <CommandPrimitive shouldFilter={false} loop className={COMMAND_CLASS}>
      {children}
    </CommandPrimitive>
  );
  if (desktop) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] border border-border-light bg-white p-0 shadow-[0_22px_60px_rgba(20,20,21,0.16)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
          >
            <VisuallyHidden.Root>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            </VisuallyHidden.Root>
            {body}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-gray-300/20 backdrop-blur-sm" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[24px] border border-border-light bg-white pb-[calc(env(safe-area-inset-bottom)+12px)]"
        >
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-gray-200" />
          <VisuallyHidden.Root>
            <Drawer.Title>{title}</Drawer.Title>
          </VisuallyHidden.Root>
          {body}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center border-b border-border-light px-4 py-1" cmdk-input-wrapper="">
      <Search className="mr-2 size-4 shrink-0 text-text-low" aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          "flex h-11 min-w-0 flex-1 bg-transparent py-3 text-sm text-text-extra-high outline-none placeholder:text-text-low disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-[300px] overflow-x-hidden overflow-y-auto p-2", className)}
      {...props}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn("py-6 text-center text-sm text-text-low", className)}
      {...props}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-low",
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-pointer items-center rounded-2xl px-3 py-2 text-sm outline-none select-none aria-selected:bg-gray-50 data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-default",
        className,
      )}
      {...props}
    />
  );
}

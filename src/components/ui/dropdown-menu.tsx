"use client";

import type { ComponentProps } from "react";
import { cn } from "cn";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { slotted } from "@/components/ui/slotted";

const DropdownMenu = slotted(DropdownMenuPrimitive.Root, "dropdown-menu");

const DropdownMenuTrigger = slotted(DropdownMenuPrimitive.Trigger, "dropdown-menu-trigger");

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-2xl border border-border-light bg-white p-1.5 text-text-extra-high shadow-[0_18px_48px_rgba(20,20,21,0.16)] duration-150 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium text-text-medium outline-hidden select-none focus:bg-gray-50 focus:text-text-extra-high data-inset:pl-7 data-[variant=destructive]:text-status-error-text data-[variant=destructive]:focus:bg-status-error-bg data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-status-error-text",
        className,
      )}
      {...props}
    />
  );
}

const DropdownMenuSeparator = slotted(
  DropdownMenuPrimitive.Separator,
  "dropdown-menu-separator",
  "-mx-1.5 my-1 h-px bg-border-extra-light",
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};

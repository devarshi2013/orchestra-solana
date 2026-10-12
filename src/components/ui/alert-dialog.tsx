"use client";

import type { ComponentProps } from "react";
import { cn } from "cn";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { slotted } from "@/components/ui/slotted";

const AlertDialog = slotted(AlertDialogPrimitive.Root, "alert-dialog");

const AlertDialogPortal = slotted(AlertDialogPrimitive.Portal, "alert-dialog-portal");

const AlertDialogOverlay = slotted(
  AlertDialogPrimitive.Overlay,
  "alert-dialog-overlay",
  "fixed inset-0 z-50 bg-background/40 duration-150 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
);

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content> & {
  size?: "default" | "sm";
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[32px] border border-border-light bg-white p-6 text-text-extra-high shadow-[0_22px_60px_rgba(20,20,21,0.16)] duration-150 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

const AlertDialogHeader = slotted(
  "div",
  "alert-dialog-header",
  "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
);

const AlertDialogFooter = slotted(
  "div",
  "alert-dialog-footer",
  "-mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-[32px] border-t border-border-light bg-gray-50/80 px-6 py-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
);

const AlertDialogTitle = slotted(
  AlertDialogPrimitive.Title,
  "alert-dialog-title",
  "text-title-sm text-text-extra-high sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
);

const AlertDialogDescription = slotted(
  AlertDialogPrimitive.Description,
  "alert-dialog-description",
  "text-body-md text-balance text-text-medium md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-text-extra-high",
);

/** The footer buttons take Button's look. */
type ButtonLook = Pick<ComponentProps<typeof Button>, "variant" | "size">;

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> & ButtonLook) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Action
        data-slot="alert-dialog-action"
        className={cn(className)}
        {...props}
      />
    </Button>
  );
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel> & ButtonLook) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Cancel
        data-slot="alert-dialog-cancel"
        className={cn(className)}
        {...props}
      />
    </Button>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};

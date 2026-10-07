"use client";

import * as React from "react";
import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";

/** Segmented tabs (Radix: arrow keys move between tabs, Home/End jump). */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 w-fit items-center gap-1 rounded-lg border bg-muted/60 p-1",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-soft dark:data-[state=active]:bg-surface-raised [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };

"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The chat app runs in the browser only: its history, wallet and preferences
 * all live there, so a server render could only show the wrong state.
 */
export const ChatAppLoader = dynamic(() => import("./assistant-chat").then((m) => m.ChatApp), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh" role="status" aria-label="Loading the assistant">
      <div className="hidden w-65 shrink-0 space-y-3 border-r bg-surface p-3 md:block">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex-1" />
    </div>
  ),
});

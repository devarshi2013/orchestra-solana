"use client";

import dynamic from "next/dynamic";

import { TickertapeMark } from "@/components/brand/tickertape-mark";
import { ProgressBar } from "@/components/motion";

/**
 * The chat app runs in the browser only: its history, wallet and preferences
 * all live there, so a server render could only show the wrong state.
 */
export const ChatAppLoader = dynamic(() => import("./assistant-chat").then((m) => m.ChatApp), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[calc(100dvh-var(--header-height))] flex-col items-center justify-center gap-3 border-t border-border-light"
      role="status"
      aria-label="Loading Tickertape"
    >
      <TickertapeMark className="h-12 text-text-extra-high" />
      <span className="text-title-sm text-text-extra-high">Tickertape</span>
      <ProgressBar label="Loading" className="mt-2 w-40 rounded-full" />
    </div>
  ),
});

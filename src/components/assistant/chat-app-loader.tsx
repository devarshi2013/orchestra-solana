"use client";

import dynamic from "next/dynamic";

import { LogoMark } from "@/components/brand/logo";

/**
 * The chat app runs in the browser only: its history, wallet and preferences
 * all live there, so a server render could only show the wrong state.
 */
export const ChatAppLoader = dynamic(() => import("./assistant-chat").then((m) => m.ChatApp), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-dvh flex-col items-center justify-center gap-3"
      role="status"
      aria-label="Loading Quill"
    >
      <LogoMark className="size-12 animate-pulse motion-reduce:animate-none" />
      <span className="font-serif text-lg text-muted-foreground">quill</span>
    </div>
  ),
});

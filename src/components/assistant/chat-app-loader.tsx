"use client";

import dynamic from "next/dynamic";

import { LogoMark } from "@/components/brand/logo";
import { ProgressBar } from "@/components/motion";

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
      <LogoMark className="size-12" />
      <span className="text-lg font-semibold tracking-tight text-primary-text">quill</span>
      <ProgressBar label="Loading" className="mt-2 w-40 rounded-full" />
    </div>
  ),
});

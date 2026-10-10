import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ChatAppLoader } from "@/components/assistant/chat-app-loader";

export const metadata: Metadata = { title: "Stock assistant" };

/**
 * One chat app for /chat (a new chat) and /chat/[id] (a saved one). It lives
 * in the layout so moving between chats keeps it mounted; the pages are empty.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Server-rendered marker: globals.css hides the site footer while it's on the page (the app fills the screen under the navbar). */}
      <div data-chat-shell hidden />
      <ChatAppLoader />
      {children}
    </>
  );
}

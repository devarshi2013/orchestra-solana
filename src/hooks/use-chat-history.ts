"use client";

import { useCallback, useState } from "react";

import type { ChatTurn } from "@/hooks/use-agent-chat";
import { loadChats, saveChats, titleFrom, type StoredChat } from "@/lib/assistant/chat-history";

const browserStorage = () => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined; // Storage blocked (e.g. some private modes).
  }
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * The connected wallet's past chats, from this browser's storage. Mount it
 * per wallet (keyed by address): the list is read once, when it mounts.
 */
export function useChatHistory(wallet: string) {
  const [chats, setChats] = useState<StoredChat[]>(() => loadChats(browserStorage(), wallet));

  const commit = useCallback(
    (change: (all: StoredChat[]) => StoredChat[]) =>
      setChats((all) => saveChats(browserStorage(), wallet, change(all))),
    [wallet],
  );

  /** Stores a conversation under `id` (a new one when null); returns its id. */
  const save = useCallback(
    (id: string | null, turns: ChatTurn[], history: unknown[]) => {
      const chatId = id ?? newId();
      const firstMessage = turns.find((t) => t.role === "user")?.text ?? "";
      const now = Date.now();
      commit((all) => {
        const existing = all.find((c) => c.id === chatId);
        const chat: StoredChat = {
          id: chatId,
          title: existing?.renamed ? existing.title : titleFrom(firstMessage),
          renamed: existing?.renamed ?? false,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          turns,
          history,
        };
        return [chat, ...all.filter((c) => c.id !== chatId)];
      });
      return chatId;
    },
    [commit],
  );

  const rename = useCallback(
    (id: string, title: string) => {
      const clean = title.replace(/\s+/g, " ").trim().slice(0, 80);
      if (!clean) return;
      commit((all) => all.map((c) => (c.id === id ? { ...c, title: clean, renamed: true } : c)));
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => commit((all) => all.filter((c) => c.id !== id)),
    [commit],
  );

  return { chats, save, rename, remove };
}

"use client";

import { useCallback, useEffect, useState } from "react";

import type { AssistantTurn, ChatTurn } from "@/hooks/use-agent-chat";
import {
  applyAiTitle,
  clearChats,
  deleteChat,
  GUEST,
  loadChats,
  moveGuestChats,
  pinChat,
  renameChat,
  saveChats,
  storageKey,
  upsertChat,
  type Owner,
  type StoredChat,
} from "@/lib/assistant/chat-history";

export const browserStorage = () => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined; // Storage blocked (e.g. some private modes).
  }
};

export const newChatId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * The chats of `owner` (a wallet address, or "guest" before one connects),
 * from this browser's storage. Switches lists when the owner changes, and
 * follows changes made in other tabs.
 */
export function useChatHistory(owner: Owner) {
  const [state, setState] = useState(() => ({
    owner,
    chats: loadChats(browserStorage(), owner),
  }));
  // A different owner: read their list now, during render, so no frame shows the old one.
  let current = state;
  if (state.owner !== owner) {
    current = { owner, chats: loadChats(browserStorage(), owner) };
    setState(current);
  }
  const { chats } = current;

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === storageKey(owner)) {
        setState({ owner, chats: loadChats(browserStorage(), owner) });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [owner]);

  const commit = useCallback(
    (change: (all: StoredChat[]) => StoredChat[]) =>
      setState((s) =>
        s.owner === owner
          ? { owner, chats: saveChats(browserStorage(), owner, change(s.chats)) }
          : s,
      ),
    [owner],
  );

  /** Stores a conversation under `id` (created on its first save). */
  const save = useCallback(
    (id: string, turns: ChatTurn[], history: unknown[]) =>
      commit((all) => upsertChat(all, id, turns, history, Date.now())),
    [commit],
  );
  const rename = useCallback(
    (id: string, title: string) => commit((all) => renameChat(all, id, title)),
    [commit],
  );
  const setAiTitle = useCallback(
    (id: string, title: string) => commit((all) => applyAiTitle(all, id, title)),
    [commit],
  );
  const pin = useCallback(
    (id: string, pinned: boolean) => commit((all) => pinChat(all, id, pinned)),
    [commit],
  );
  const remove = useCallback((id: string) => commit((all) => deleteChat(all, id)), [commit]);
  /** Changes one assistant turn of a saved chat, e.g. a purchase made from a reopened plan. */
  const patchTurn = useCallback(
    (id: string, index: number, change: Partial<AssistantTurn>) =>
      commit((all) =>
        all.map((c) =>
          c.id === id
            ? {
                ...c,
                updatedAt: Date.now(),
                turns: c.turns.map((t, i) =>
                  i === index && t.role === "assistant" ? { ...t, ...change } : t,
                ),
              }
            : c,
        ),
      ),
    [commit],
  );
  const clearAll = useCallback(() => {
    clearChats(browserStorage(), owner);
    setState({ owner, chats: [] });
  }, [owner]);

  /** Moves the guest chats into this wallet's list (only for a wallet owner). */
  const adoptGuestChats = useCallback(() => {
    if (owner === GUEST) return;
    setState({ owner, chats: moveGuestChats(browserStorage(), owner) });
  }, [owner]);

  return {
    owner,
    chats,
    save,
    rename,
    setAiTitle,
    pin,
    remove,
    patchTurn,
    clearAll,
    adoptGuestChats,
  };
}

/** How many guest chats this browser holds (0 when storage is unavailable). */
export function guestChatCount(): number {
  return loadChats(browserStorage(), GUEST).length;
}

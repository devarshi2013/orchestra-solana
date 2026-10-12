"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, PanelLeftOpen, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";

import { useWallet } from "@/components/wallet";
import { Appear } from "@/components/motion";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAgentChat,
  type AssistantTurn,
  type ChatTurn,
  type SavedBuy,
} from "@/hooks/use-agent-chat";
import { guestChatCount, newChatId, useChatHistory } from "@/hooks/use-chat-history";
import { usePersistentFlag } from "@/hooks/use-persistent-flag";
import { chatIdFromPath, GUEST } from "@/lib/assistant/chat-history";
import { cn } from "@/lib/utils";

import { ChatSidebar } from "./chat-sidebar";
import { IconButton, SoftButton } from "./controls";
import { Composer } from "./composer";
import { PlanCard } from "./plan-card";
import { StrategyCard } from "./strategy-card";
import { AssistantTurnView, UserBubble } from "./turn";

/** The chat's text box. */
const INPUT_ID = "chat-input";

// Named before the rebrands (to Quill, then Tickertape); kept so the saved preference carries over.
const COLLAPSED_KEY = "askfirst.sidebar.collapsed";
/** How long a reload waits for the wallet to reconnect before saying a chat isn't here. */
const RECONNECT_GRACE_MS = 2_500;

/** The ?q= question from the home page (trimmed, at most 200 characters). Read only. */
function prefillFromUrl(): string {
  try {
    const q = new URL(window.location.href).searchParams.get("q") ?? "";
    return q.replace(/\s+/g, " ").trim().slice(0, 200);
  } catch {
    return "";
  }
}

/**
 * Changes the URL without a server round trip (Next.js keeps usePathname in
 * sync).
 */
function go(path: string, replace = false) {
  if (window.location.pathname === path) return;
  if (replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
}

/** First reply finished and the title is still the automatic one: time to ask for a better one. */
async function fetchAiTitle(turns: ChatTurn[]): Promise<string | null> {
  const message = turns.find((t) => t.role === "user")?.text;
  const reply = turns.find((t) => t.role === "assistant")?.text ?? "";
  if (!message) return null;
  try {
    const response = await fetch("/api/agent/title", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, reply: reply.slice(0, 1500) }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { title?: unknown };
    return typeof body.title === "string" ? body.title : null;
  } catch {
    return null;
  }
}

/**
 * The stock assistant as a full-screen app: chat history in a sidebar (a
 * drawer on phones) and the conversation, where each reply is a research note
 * (data used, live trail, sources) and each plan a trade ticket. An empty
 * chat is just the input. Each chat has its own URL (/chat/[id]); /chat is a
 * new chat. History lives in this browser, per wallet, with a guest list
 * before a wallet connects.
 */
export function ChatApp() {
  const { publicKey, connecting, wallet: selectedWallet } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const owner = wallet ?? GUEST;
  const routeId = chatIdFromPath(usePathname());

  const history = useChatHistory(owner);
  const chat = useAgentChat(wallet);
  const { turns, busy } = chat;

  // "Ask Tickertape about NVDA" on the home page arrives as ?q=…: pre-fill it, never auto-send.
  const [input, setInput] = useState(prefillFromUrl);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("q")) return;
    url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const [collapsed, setCollapsed] = usePersistentFlag(COLLAPSED_KEY);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The chat in `chat` (the live one you send in): its id once it has one,
  // and whose list it belongs to. The URL decides what's on screen: this live
  // chat, or a saved one shown from storage until you send a message in it.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeOwner, setActiveOwner] = useState(owner);
  // Turns of the live chat that were restored from storage: their plan cards are read-only.
  const [archivedCount, setArchivedCount] = useState(0);

  const stored = routeId ? history.chats.find((c) => c.id === routeId) : undefined;
  const live = routeId === activeId && activeOwner === owner;
  const viewId = live ? activeId : routeId;
  const viewTurns: ChatTurn[] = live ? turns : (stored?.turns ?? []);
  const empty = viewTurns.length === 0;
  const viewArchived = live ? archivedCount : Number.POSITIVE_INFINITY;

  // Save the live chat when a message is sent, when a reply finishes, and as a
  // purchase moves on. A chat exists only once its first message is sent.
  const saved = useRef<ChatTurn[] | null>(null);
  const savedLength = useRef(0);
  const titled = useRef(new Set<string>());
  const { save, setAiTitle } = history;
  useEffect(() => {
    if (!activeId || activeOwner !== owner) return;
    if (turns.length === 0 || turns === saved.current) return;
    if (busy && turns.length === savedLength.current) return; // streaming: save at the end
    saved.current = turns;
    savedLength.current = turns.length;
    save(activeId, turns, chat.history);
    const first = turns.find((t) => t.role === "assistant");
    if (!busy && first?.done && first.text && !titled.current.has(activeId)) {
      const id = activeId;
      titled.current.add(id);
      void fetchAiTitle(turns).then((title) => title && setAiTitle(id, title));
    }
  }, [busy, turns, chat.history, activeId, activeOwner, owner, save, setAiTitle]);

  // A reload waits briefly for the wallet to reconnect before saying a chat isn't here.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), RECONNECT_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  // Chats made as a guest: offer them to the wallet that just connected.
  const [declined, setDeclined] = useState<Set<string>>(() => new Set());
  const guestCount = useMemo(
    () => (owner === GUEST ? 0 : guestChatCount()),
    // Re-count when the lists change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner, history.chats],
  );
  const offerMove = guestCount > 0 && !declined.has(owner);

  /** Starts over with an empty live chat (stopping a reply that's still streaming). */
  const { reset: resetChat } = chat;
  const resetLive = useCallback(() => {
    resetChat();
    saved.current = null;
    savedLength.current = 0;
    setActiveId(null);
    setArchivedCount(0);
  }, [resetChat]);

  const openChat = (id: string) => {
    setDrawerOpen(false);
    if (id !== routeId) go(`/chat/${id}`);
  };

  const newChat = useCallback(() => {
    setDrawerOpen(false);
    setInput("");
    go("/chat");
    // A reply still streaming keeps going (and is saved) in its own chat.
    if (!busy) resetLive();
  }, [busy, resetLive]);

  // Ctrl/Cmd+Shift+O: new chat.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  const deleteChat = (id: string) => {
    history.remove(id);
    if (id === activeId) resetLive();
    if (id === routeId) go("/chat", true);
  };

  const clearAll = () => {
    history.clearAll();
    resetLive();
    go("/chat", true);
  };

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    if (live && activeId) {
      void chat.send(text);
      return;
    }
    // A new chat, or a saved one on screen: it becomes the live chat.
    const id = stored?.id ?? newChatId();
    saved.current = stored?.turns ?? null;
    savedLength.current = stored?.turns.length ?? 0;
    setActiveId(id);
    setActiveOwner(owner);
    setArchivedCount(stored?.turns.length ?? 0);
    void chat.send(text, stored ?? { turns: [], history: [] });
    if (!routeId) go(`/chat/${id}`, true);
  };

  /** Keeps a change to one reply (a plan's purchase, a created strategy) with its chat. */
  const patchTurn = (index: number, change: Partial<AssistantTurn>) => {
    if (live) chat.updateTurn(index, change);
    else if (viewId) history.patchTurn(viewId, index, change);
  };
  const recordBuy = (index: number, buy: SavedBuy) => patchTurn(index, { buy });

  // Follow the conversation when a message is sent or another chat opens.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: viewTurns.length === 0 ? 0 : scroller.current.scrollHeight });
  }, [viewTurns.length, viewId]);

  const missing = routeId !== null && !live && !stored;
  const reconnecting = missing && !settled && (connecting || (selectedWallet !== null && !wallet));

  const sidebarProps = {
    chats: history.chats,
    activeId: viewId,
    busy,
    guest: owner === GUEST,
    onNew: newChat,
    onOpen: openChat,
    onRename: history.rename,
    onPin: history.pin,
    onDelete: deleteChat,
    onClearAll: clearAll,
  };

  const composer = (
    <Composer
      value={input}
      onValueChange={setInput}
      onSend={send}
      onStop={chat.cancel}
      busy={busy && live}
      inputId={INPUT_ID}
    />
  );

  return (
    // Fills the screen under the fixed site header; its panels scroll natively.
    <div
      data-chat-app
      className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden border-t border-border-extra-light bg-white"
    >
      {!collapsed && (
        <aside aria-label="Chats" className="hidden w-68 shrink-0 flex-col bg-rail md:flex">
          <ChatSidebar {...sidebarProps} onCollapse={() => setCollapsed(true)} />
        </aside>
      )}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-76 max-w-[88vw] gap-0 bg-rail p-0">
          <SheetTitle className="sr-only">Chats</SheetTitle>
          <SheetDescription className="sr-only">Your saved chats</SheetDescription>
          <ChatSidebar {...sidebarProps} />
        </SheetContent>
      </Sheet>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute top-3 left-3 z-20 flex gap-1">
          <ChatControl
            className="md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open chats"
          >
            <Menu />
          </ChatControl>
          {collapsed && (
            <ChatControl
              className="hidden md:flex"
              onClick={() => setCollapsed(false)}
              aria-label="Open sidebar"
            >
              <PanelLeftOpen />
            </ChatControl>
          )}
          <ChatControl
            className={collapsed ? "" : "md:hidden"}
            onClick={newChat}
            disabled={busy}
            aria-label="New chat"
          >
            <Plus />
          </ChatControl>
        </div>

        <div ref={scroller} className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col px-4 pt-16 sm:px-6">
            {offerMove && (
              <div
                role="region"
                aria-label="Chats from before you connected"
                className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-soft p-3 pl-4 text-[13.5px] tracking-[-0.01em] text-text-high"
              >
                <p className="min-w-0 flex-1 basis-48">
                  Move {guestCount} guest {guestCount === 1 ? "chat" : "chats"} to this wallet?
                </p>
                <div className="flex gap-1.5">
                  <SoftButton onClick={() => setDeclined((s) => new Set(s).add(owner))}>
                    Not now
                  </SoftButton>
                  <SoftButton dark onClick={history.adoptGuestChats}>
                    Move
                  </SoftButton>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {reconnecting ? (
                <div
                  key="opening"
                  className="space-y-3 py-8"
                  role="status"
                  aria-label="Opening chat"
                >
                  <Skeleton className="ml-auto h-10 w-2/3 rounded-[18px]" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : missing ? (
                <div
                  key="missing"
                  className="flex flex-1 flex-col items-center justify-center gap-4 pb-24 text-center"
                >
                  <p className="text-[15px] tracking-[-0.01em] text-text-high">
                    This chat isn&apos;t saved here.
                  </p>
                  <SoftButton onClick={newChat}>
                    <Plus className="size-4" /> New chat
                  </SoftButton>
                </div>
              ) : empty ? (
                <motion.div
                  key="empty"
                  className="flex flex-1 flex-col justify-center gap-6 pb-[18vh]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <h1 className="text-center text-[28px] leading-tight font-medium tracking-[-0.02em] text-text-extra-high">
                    Ask about any stock
                  </h1>
                  {composer}
                </motion.div>
              ) : (
                <motion.div
                  key="conversation"
                  className="flex flex-1 flex-col"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex-1 space-y-8 pb-6" aria-live="polite">
                    {viewTurns.map((turn, i) => (
                      <Appear key={`${viewId ?? "new"}-${i}`}>
                        {turn.role === "user" ? (
                          <UserBubble text={turn.text} />
                        ) : (
                          <AssistantTurnView
                            turn={turn}
                            cards={
                              <>
                                {turn.plan && (
                                  <PlanCard
                                    plan={turn.plan}
                                    saved={turn.buy}
                                    archived={i < viewArchived}
                                    onBuyChange={(buy) => recordBuy(i, buy)}
                                  />
                                )}
                                {turn.strategy && (
                                  <StrategyCard
                                    strategy={turn.strategy}
                                    createdId={turn.strategyId}
                                    onCreated={(strategyId) => patchTurn(i, { strategyId })}
                                  />
                                )}
                              </>
                            }
                          />
                        )}
                      </Appear>
                    ))}
                  </div>
                  <div className="sticky bottom-0 z-10 bg-linear-to-t from-white via-white to-white/0 pt-4 pb-5">
                    {composer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A round control floating over the conversation (open chats, new chat). */
function ChatControl({ className, ...props }: ComponentProps<"button">) {
  return <IconButton className={cn("bg-white shadow-hairline", className)} {...props} />;
}

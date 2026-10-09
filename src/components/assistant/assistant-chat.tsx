"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import {
  Cpu,
  Fuel,
  Landmark,
  LibraryBig,
  Menu,
  PanelLeftOpen,
  ShieldAlert,
  SquarePen,
  TrendingUp,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Appear } from "@/components/motion";
import {
  AnimatedChatInput,
  ChatGlow,
  ChatHero,
  type ChatCommand,
} from "@/components/ui/animated-ai-chat";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentChat, type ChatTurn, type SavedBuy } from "@/hooks/use-agent-chat";
import { guestChatCount, newChatId, useChatHistory } from "@/hooks/use-chat-history";
import { usePersistentFlag } from "@/hooks/use-persistent-flag";
import { chatIdFromPath, GUEST } from "@/lib/assistant/chat-history";

import { ChatSidebar } from "./chat-sidebar";
import { DisclosureGate } from "./disclosure-gate";
import { PlanCard } from "./plan-card";
import { StockBrowser } from "./stock-browser";
import { AssistantTurnView, UserBubble } from "./turn";

/** "/" commands and starter chips: each fills the input with a prompt to edit or send. */
const COMMANDS: ChatCommand[] = [
  {
    icon: <Cpu className="size-4" />,
    label: "Top tech",
    prefix: "/tech",
    prompt:
      "I have 200 USDC. Suggest 3 large US tech stocks ranked by market cap, with live quotes.",
  },
  {
    icon: <Landmark className="size-4" />,
    label: "Biggest banks",
    prefix: "/banks",
    prompt: "What are the biggest banks I can buy? Plan 100 USDC across the top 2.",
  },
  {
    icon: <Fuel className="size-4" />,
    label: "Energy ETFs",
    prefix: "/energy",
    prompt: "Show me energy ETFs and compare their price impact for a 50 USDC buy.",
  },
  {
    icon: <TrendingUp className="size-4" />,
    label: "Best performers",
    prefix: "/returns",
    prompt:
      "Which highly liquid stocks had the best 1-year return? Plan 100 USDC across the top 2.",
  },
];

// Named before the rebrand to Quill; kept so the saved preference carries over.
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
 * sync). The query string (the Browse stocks filters) carries over.
 */
function go(path: string, replace = false) {
  if (window.location.pathname === path) return;
  const url = path + window.location.search;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

/** Whether a media query matches (false until the browser says otherwise). */
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
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
 * The stock assistant as a full-screen app, ChatGPT-style: chat history in a
 * sidebar (a drawer on phones), the conversation with streamed replies,
 * "data used" panels and plan cards, and the stock browser. Each chat has its
 * own URL (/chat/[id]); /chat is a new chat. History lives in this browser,
 * per wallet, with a guest list before a wallet connects.
 */
export function ChatApp() {
  const { publicKey, connecting, wallet: selectedWallet } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const owner = wallet ?? GUEST;
  const routeId = chatIdFromPath(usePathname());

  const history = useChatHistory(owner);
  const chat = useAgentChat(wallet);
  const { turns, busy } = chat;

  // "Ask Quill about NVDA" on the home page arrives as ?q=…: pre-fill it, never auto-send.
  const [input, setInput] = useState(prefillFromUrl);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("q")) return;
    url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const [collapsed, setCollapsed] = usePersistentFlag(COLLAPSED_KEY);
  // One Browse stocks panel at a time (it owns the filter query string): a column on wide screens.
  const wide = useMediaQuery("(min-width: 1280px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

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
    setBrowseOpen(false);
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

  const { updateTurn } = chat;
  const { patchTurn } = history;
  const recordBuy = useCallback(
    (index: number, buy: SavedBuy) => {
      if (live) updateTurn(index, { buy });
      else if (viewId) patchTurn(viewId, index, { buy });
    },
    [live, viewId, updateTurn, patchTurn],
  );

  // Follow the conversation when a message is sent or another chat opens.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [viewTurns.length, viewId]);

  const activeChat = viewId ? history.chats.find((c) => c.id === viewId) : undefined;
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
    <AnimatedChatInput
      value={input}
      onValueChange={setInput}
      onSend={send}
      busy={busy}
      commands={COMMANDS}
      showChips={empty}
      placeholder="Ask about tokenized stocks, or type / for ideas…"
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {!collapsed && (
        <aside
          aria-label="Chats"
          className="hidden w-65 shrink-0 flex-col border-r bg-surface md:flex"
        >
          <ChatSidebar {...sidebarProps} onCollapse={() => setCollapsed(true)} />
        </aside>
      )}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-70 max-w-[85vw] gap-0 p-0">
          <SheetTitle className="sr-only">Chats</SheetTitle>
          <SheetDescription className="sr-only">
            Your chat history, saved in this browser.
          </SheetDescription>
          <ChatSidebar {...sidebarProps} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2 sm:px-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open chat history"
          >
            <Menu />
          </Button>
          {collapsed && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden md:inline-flex"
              onClick={() => setCollapsed(false)}
              aria-label="Open sidebar"
            >
              <PanelLeftOpen />
            </Button>
          )}
          <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-medium">
            {activeChat?.title ?? "New chat"}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            className="xl:hidden"
            onClick={() => setBrowseOpen(true)}
            aria-label="Browse stocks"
          >
            <LibraryBig /> <span className="hidden sm:inline">Browse stocks</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={collapsed ? "" : "md:hidden"}
            onClick={newChat}
            disabled={busy}
            aria-label="New chat"
          >
            <SquarePen />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div ref={scroller} className="relative isolate min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-6 sm:px-6">
              {offerMove && (
                <div
                  role="region"
                  aria-label="Chats from before you connected"
                  className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm"
                >
                  <p className="min-w-0 flex-1 basis-56">
                    You have {guestCount} {guestCount === 1 ? "chat" : "chats"} from before you
                    connected this wallet. Move {guestCount === 1 ? "it" : "them"} here?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeclined((s) => new Set(s).add(owner))}
                    >
                      Not now
                    </Button>
                    <Button size="sm" onClick={history.adoptGuestChats}>
                      Move to this wallet
                    </Button>
                  </div>
                </div>
              )}

              <DisclosureGate>
                <ChatGlow />
                {reconnecting ? (
                  <div className="space-y-3 py-8" role="status" aria-label="Opening chat">
                    <Skeleton className="ml-auto h-9 w-2/3 rounded-2xl" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                ) : missing ? (
                  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
                    <h2 className="text-lg font-semibold">This chat isn&apos;t here</h2>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Chats are saved in the browser they were made in, for the wallet that made
                      them. Connect that wallet, or start a new chat.
                    </p>
                    <Button onClick={newChat}>
                      <SquarePen /> New chat
                    </Button>
                  </div>
                ) : empty ? (
                  <motion.div
                    className="flex flex-1 flex-col justify-center space-y-10 py-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  >
                    <ChatHero
                      title="How can I help today?"
                      subtitle="Research tokenized US stocks on Solana with live data and real Jupiter quotes"
                    />
                    {composer}
                  </motion.div>
                ) : (
                  <div className="flex flex-1 flex-col">
                    <div className="flex-1 space-y-6" aria-live="polite">
                      {viewTurns.map((turn, i) =>
                        turn.role === "user" ? (
                          <Appear key={`${viewId ?? "new"}-${i}`}>
                            <UserBubble text={turn.text} />
                          </Appear>
                        ) : (
                          <Appear key={`${viewId ?? "new"}-${i}`}>
                            <AssistantTurnView
                              turn={turn}
                              cards={
                                turn.plan && (
                                  <Appear y={14} delay={0.05}>
                                    <PlanCard
                                      plan={turn.plan}
                                      saved={turn.buy}
                                      archived={i < viewArchived}
                                      onBuyChange={(buy) => recordBuy(i, buy)}
                                    />
                                  </Appear>
                                )
                              }
                            />
                          </Appear>
                        ),
                      )}
                    </div>
                    <div className="sticky bottom-0 z-10 bg-linear-to-t from-background via-background/90 to-transparent pt-6 pb-4">
                      {composer}
                    </div>
                  </div>
                )}
              </DisclosureGate>
              <p className="mt-2 mb-4 flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldAlert className="mt-px size-3.5 shrink-0" />
                The assistant researches and proposes; it never trades. Figures come from live data
                tools (open &ldquo;Data used&rdquo;), and you approve every buy in your wallet.
                Research, not financial advice.
              </p>
            </div>
          </div>
          {wide && (
            <aside aria-label="Browse stocks" className="w-96 shrink-0 border-l p-4">
              <StockBrowser onAsk={send} disabled={busy} />
            </aside>
          )}
        </div>
      </div>

      <Sheet open={browseOpen && !wide} onOpenChange={setBrowseOpen}>
        <SheetContent side="right" className="w-88 max-w-[92vw] p-4">
          <SheetTitle className="sr-only">Browse stocks</SheetTitle>
          <SheetDescription className="sr-only">
            Every stock you can research, by sector.
          </SheetDescription>
          <StockBrowser onAsk={send} disabled={busy} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

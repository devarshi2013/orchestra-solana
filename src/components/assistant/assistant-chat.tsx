"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, HeartPulse, Menu, PanelLeftOpen, Plus, Scale, TrendingUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GridOverlay, Orbs } from "@/components/design/effects";
import { PauseOffscreen } from "@/components/design/text";
import { Appear, ProgressBar } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentChat, type ChatTurn, type SavedBuy } from "@/hooks/use-agent-chat";
import { guestChatCount, newChatId, useChatHistory } from "@/hooks/use-chat-history";
import { usePersistentFlag } from "@/hooks/use-persistent-flag";
import { chatIdFromPath, GUEST } from "@/lib/assistant/chat-history";

import { ChatSidebar } from "./chat-sidebar";
import { Composer, type ChatCommand } from "./composer";
import { DisclosureGate } from "./disclosure-gate";
import { PlanCard } from "./plan-card";
import { EXAMPLES, ResearchIntro } from "./research-intro";
import { Tip } from "./tip";
import { AssistantTurnView, UserBubble } from "./turn";

/** "/" commands in the command bar: the same example questions the empty screen offers. */
const COMMAND_META = [
  { icon: <Cpu className="size-4" />, prefix: "/tech" },
  { icon: <Scale className="size-4" />, prefix: "/compare" },
  { icon: <HeartPulse className="size-4" />, prefix: "/health" },
  { icon: <TrendingUp className="size-4" />, prefix: "/value" },
];
const COMMANDS: ChatCommand[] = EXAMPLES.map((prompt, i) => ({
  ...COMMAND_META[i]!,
  label: prompt,
  prompt,
}));

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
 * chat shows the intro and example questions. Each chat has its
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
    // An empty chat starts at the top, so the intro's headline is in view on small screens.
    scroller.current?.scrollTo({ top: viewTurns.length === 0 ? 0 : scroller.current.scrollHeight });
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
    <Composer
      value={input}
      onValueChange={setInput}
      onSend={send}
      onStop={chat.cancel}
      busy={busy && live}
      commands={COMMANDS}
      placeholder="Ask about any stock, or type / for ideas…"
    />
  );

  return (
    // Fills the screen under the site navbar (4rem); its panels scroll natively (data-chat-app).
    // data-research scopes this page's button styles (globals.css).
    <div
      data-chat-app
      data-research
      className="flex h-[calc(100dvh-4rem-1px)] overflow-hidden bg-background"
    >
      {!collapsed && (
        <aside
          aria-label="Chats"
          className="hidden w-70 shrink-0 flex-col border-r bg-surface md:flex"
        >
          <ChatSidebar {...sidebarProps} onCollapse={() => setCollapsed(true)} />
        </aside>
      )}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent data-research side="left" className="w-76 max-w-[88vw] gap-0 p-0">
          <SheetTitle className="sr-only">Chats</SheetTitle>
          <SheetDescription className="sr-only">
            Your chat history, saved in this browser.
          </SheetDescription>
          <ChatSidebar {...sidebarProps} />
        </SheetContent>
      </Sheet>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {busy && live && (
          <ProgressBar label="Writing a reply" className="absolute inset-x-0 top-12 z-20" />
        )}
        <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2 sm:px-3">
          <Tip label="Chat history">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open chat history"
            >
              <Menu />
            </Button>
          </Tip>
          {collapsed && (
            <Tip label="Open sidebar">
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden md:inline-flex"
                onClick={() => setCollapsed(false)}
                aria-label="Open sidebar"
              >
                <PanelLeftOpen />
              </Button>
            </Tip>
          )}
          <h1 className="min-w-0 flex-1 truncate px-1 font-heading text-sm font-semibold tracking-tight">
            {activeChat?.title ?? "New chat"}
          </h1>
          <Tip label="New chat">
            <Button
              variant="ghost"
              size="icon-sm"
              className={collapsed ? "" : "md:hidden"}
              onClick={newChat}
              disabled={busy}
              aria-label="New chat"
            >
              <Plus />
            </Button>
          </Tip>
        </header>

        <div className="flex min-h-0 flex-1">
          <div ref={scroller} className="relative isolate min-w-0 flex-1 overflow-y-auto">
            {/* The home page's backdrop, behind an empty chat only. */}
            {empty && !missing && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem]"
              >
                <PauseOffscreen className="absolute inset-0">
                  <Orbs />
                </PauseOffscreen>
                <GridOverlay className="[mask-image:radial-gradient(ellipse_at_top,#000_10%,transparent_65%)]" />
              </div>
            )}
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-6 sm:px-6">
              {offerMove && (
                <div
                  role="region"
                  aria-label="Chats from before you connected"
                  className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3.5 text-sm"
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
                {/* The intro fades away as the first message is sent. */}
                <AnimatePresence mode="wait" initial={false}>
                  {reconnecting ? (
                    <div
                      key="opening"
                      className="space-y-3 py-8"
                      role="status"
                      aria-label="Opening chat"
                    >
                      <Skeleton className="ml-auto h-9 w-2/3 rounded-2xl" />
                      <Skeleton className="h-4 w-11/12" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  ) : missing ? (
                    <div
                      key="missing"
                      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center"
                    >
                      <h2 className="font-heading text-2xl font-semibold tracking-tight">
                        This chat isn&apos;t here
                      </h2>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Chats are saved in the browser they were made in, for the wallet that made
                        them. Connect that wallet, or start a new chat.
                      </p>
                      <Button onClick={newChat}>
                        <Plus /> New chat
                      </Button>
                    </div>
                  ) : empty ? (
                    <motion.div
                      key="intro"
                      className="flex flex-1 flex-col justify-center space-y-9 py-6"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <ResearchIntro onAsk={send} disabled={busy} />
                      {composer}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="conversation"
                      className="flex flex-1 flex-col"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="flex-1 space-y-8" aria-live="polite">
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </DisclosureGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { Cpu, Fuel, Landmark, PanelLeft, ShieldAlert, SquarePen, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AnimatedChatInput,
  ChatGlow,
  ChatHero,
  type ChatCommand,
} from "@/components/ui/animated-ai-chat";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAgentChat, type ChatTurn, type SavedBuy } from "@/hooks/use-agent-chat";
import { useChatHistory } from "@/hooks/use-chat-history";

import { ChatSidebar } from "./chat-sidebar";
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

/**
 * The stock assistant: a sidebar of past chats (kept in this browser, per
 * wallet), the conversation with streamed replies, "data used" panels and
 * plan cards (live quotes, wallet-approved buys), and the stock browser.
 * Mounted per wallet so each wallet only ever sees its own chats.
 */
export function AssistantChat() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  if (!wallet) return null;
  return <ChatWorkspace key={wallet} wallet={wallet} />;
}

export function ChatWorkspace({ wallet }: { wallet: string }) {
  const [input, setInput] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bumped when another chat is opened or a new one started: remounts the turns
  // (plan cards included) without remounting when a new chat is first saved.
  const [session, setSession] = useState(0);
  const chat = useAgentChat(wallet);
  const history = useChatHistory(wallet);
  const { turns, busy } = chat;
  const empty = turns.length === 0;

  // Save the conversation whenever a reply finishes or a purchase moves on.
  // `saved` is the last turns stored or opened, so opening a chat doesn't
  // count as activity and reorder the list.
  const saved = useRef<ChatTurn[] | null>(null);
  const idRef = useRef<string | null>(null);
  useEffect(() => {
    if (busy || turns.length === 0 || turns === saved.current) return;
    saved.current = turns;
    const id = history.save(idRef.current, turns, chat.history);
    if (idRef.current !== id) {
      idRef.current = id;
      setActiveId(id);
    }
  }, [busy, turns, chat.history, history]);

  const openChat = (id: string) => {
    const stored = history.chats.find((c) => c.id === id);
    if (!stored || busy) return;
    saved.current = stored.turns;
    idRef.current = id;
    setActiveId(id);
    setSession((n) => n + 1);
    chat.load(stored);
    setDrawerOpen(false);
  };

  const newChat = () => {
    if (busy) return;
    saved.current = null;
    idRef.current = null;
    setActiveId(null);
    setSession((n) => n + 1);
    chat.reset();
    setInput("");
    setDrawerOpen(false);
  };

  const deleteChat = (id: string) => {
    history.remove(id);
    if (id === idRef.current) newChat();
  };

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    void chat.send(text);
  };

  const { updateTurn } = chat;
  const recordBuy = useCallback(
    (index: number, buy: SavedBuy) => updateTurn(index, { buy }),
    [updateTurn],
  );

  const sidebar = (
    <ChatSidebar
      chats={history.chats}
      activeId={activeId}
      busy={busy}
      onNew={newChat}
      onOpen={openChat}
      onRename={history.rename}
      onDelete={deleteChat}
    />
  );

  const composer = (
    <AnimatedChatInput
      value={input}
      onValueChange={setInput}
      onSend={send}
      busy={busy}
      commands={COMMANDS}
      showChips={empty}
      placeholder="Ask about tokenized stocks, or type / for ideas…"
      actions={
        !empty && (
          <button
            type="button"
            onClick={newChat}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <SquarePen className="size-3.5" /> New chat
          </button>
        )
      }
    />
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
      <aside className="sticky top-20 hidden h-[calc(100vh-7rem)] lg:block">{sidebar}</aside>

      <div className="relative isolate min-w-0">
        <div className="mb-3 flex items-center gap-2 lg:hidden">
          <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
            <PanelLeft /> Chats
            {history.chats.length > 0 && (
              <span className="text-muted-foreground tabular-nums">{history.chats.length}</span>
            )}
          </Button>
          {!empty && (
            <Button variant="ghost" size="sm" onClick={newChat} disabled={busy}>
              <SquarePen /> New chat
            </Button>
          )}
        </div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-xs p-4">
            <SheetHeader className="p-0">
              <SheetTitle>Chats</SheetTitle>
              <SheetDescription>Saved in this browser for this wallet.</SheetDescription>
            </SheetHeader>
            {sidebar}
          </SheetContent>
        </Sheet>

        <ChatGlow />
        {empty ? (
          <motion.div
            className="flex min-h-[60vh] flex-col justify-center space-y-10 py-6"
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
          <div className="space-y-6">
            <div className="space-y-6" aria-live="polite">
              {turns.map((turn, i) =>
                turn.role === "user" ? (
                  <UserBubble key={`${session}-${i}`} text={turn.text} />
                ) : (
                  <AssistantTurnView
                    key={`${session}-${i}`}
                    turn={turn}
                    cards={
                      turn.plan && (
                        <PlanCard
                          plan={turn.plan}
                          saved={turn.buy}
                          onBuyChange={(buy) => recordBuy(i, buy)}
                        />
                      )
                    }
                  />
                ),
              )}
            </div>
            <div className="sticky bottom-4 z-10">{composer}</div>
          </div>
        )}
        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="mt-px size-3.5 shrink-0" />
          The assistant researches and proposes; it never trades. Every figure comes from live data
          tools (open &ldquo;Data used&rdquo;), suggestions are limited to Askfirst&apos;s verified
          stock tokens, and you approve every buy in your wallet. Research, not financial advice.
        </p>
      </div>
      <div className="lg:col-span-2 xl:col-span-1">
        <StockBrowser onAsk={send} disabled={busy} />
      </div>
    </div>
  );
}

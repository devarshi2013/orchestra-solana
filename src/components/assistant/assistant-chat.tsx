"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { Cpu, Fuel, Landmark, ShieldAlert, SquarePen, TrendingUp } from "lucide-react";
import { useState } from "react";

import {
  AnimatedChatInput,
  ChatGlow,
  ChatHero,
  type ChatCommand,
} from "@/components/ui/animated-ai-chat";
import { useAgentChat } from "@/hooks/use-agent-chat";

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
 * The stock assistant chat: streamed replies, a "data used" panel per answer,
 * and plan cards with live quotes and wallet-approved buys. The conversation
 * lives in this page only (no database); "New chat" starts over.
 */
export function AssistantChat() {
  const { publicKey } = useWallet();
  const [input, setInput] = useState("");
  const { turns, busy, send: sendMessage, reset } = useAgentChat(publicKey?.toBase58() ?? null);
  const empty = turns.length === 0;

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    void sendMessage(text);
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
      actions={
        !empty && (
          <button
            type="button"
            onClick={reset}
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
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="relative isolate min-w-0">
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
                  <UserBubble key={i} text={turn.text} />
                ) : (
                  <AssistantTurnView
                    key={i}
                    turn={turn}
                    cards={turn.plan && <PlanCard plan={turn.plan} />}
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
          tools (open &ldquo;Data used&rdquo;), suggestions are limited to Orchestra&apos;s verified
          stock tokens, and you approve every buy in your wallet. Research, not financial advice.
        </p>
      </div>
      <StockBrowser onAsk={send} disabled={busy} />
    </div>
  );
}

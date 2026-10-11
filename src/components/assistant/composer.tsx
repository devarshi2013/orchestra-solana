"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Command, Square } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Tip } from "./tip";

export type ChatCommand = {
  icon: ReactNode;
  label: string;
  /** Typed after "/" to pick it, e.g. "/tech". */
  prefix: string;
  /** The text the command puts in the input. */
  prompt: string;
};

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 200;

/** A budget typed in the "$" pill, as a clean number of dollars (0 when empty or invalid). */
const parseBudget = (text: string) => {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : 0;
};

/**
 * The chat's command bar: a floating glass bar that glows when focused. The
 * text area grows with its text (Enter sends, Shift+Enter adds a line), "/"
 * opens the example commands, the optional "$" pill adds a budget to the
 * message, and the round button sends, or stops the reply while one streams.
 * Controlled: the caller owns the text and decides what sending does.
 */
export function Composer({
  value,
  onValueChange,
  onSend,
  onStop,
  busy,
  commands,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (text: string) => void;
  /** Stops the reply streaming now. */
  onStop: () => void;
  busy: boolean;
  commands: ChatCommand[];
  placeholder?: string;
}) {
  const hintId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const commandButton = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(-1);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [budget, setBudget] = useState("");
  const reduce = useReducedMotion();

  const resize = useCallback((reset?: boolean) => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = `${MIN_HEIGHT}px`;
    if (!reset)
      el.style.height = `${Math.max(MIN_HEIGHT, Math.min(el.scrollHeight, MAX_HEIGHT))}px`;
  }, []);
  // The text can change from outside (a chip, a new chat): keep the height in step.
  useEffect(() => resize(), [value, resize]);

  // "/" + letters opens the palette on the first matching command.
  const typingCommand = value.startsWith("/") && !value.includes(" ");
  const showPalette = (paletteOpen || typingCommand) && commands.length > 0;

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!palette.current?.contains(target) && !commandButton.current?.contains(target))
        setPaletteOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (index: number) => {
    const command = commands[index];
    if (!command) return;
    onValueChange(command.prompt);
    setPaletteOpen(false);
    requestAnimationFrame(() => textarea.current?.focus());
  };

  const send = () => {
    const text = value.trim();
    if (!text || busy) return;
    const dollars = parseBudget(budget);
    onSend(dollars > 0 ? `${text}\n\nBudget: ${dollars} USDC.` : text);
    setBudget("");
    requestAnimationFrame(() => resize(true));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i < commands.length - 1 ? i + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i > 0 ? i - 1 : commands.length - 1));
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && active >= 0) {
        e.preventDefault();
        pick(active);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPaletteOpen(false);
        if (typingCommand) onValueChange("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const canSend = value.trim() !== "" && !busy;

  return (
    <div className="command-bar relative rounded-3xl border bg-card/90 shadow-lift backdrop-blur-xl transition-[border-color,box-shadow] duration-200 ease-out">
      <AnimatePresence>
        {showPalette && (
          <motion.div
            ref={palette}
            role="listbox"
            aria-label="Example questions"
            className="absolute right-3 bottom-full left-3 z-50 mb-2 overflow-hidden rounded-2xl border bg-popover/95 py-1 shadow-lift backdrop-blur-xl"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
          >
            {commands.map((command, index) => (
              <div
                key={command.prefix}
                role="option"
                aria-selected={active === index}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm transition-colors duration-150",
                  active === index
                    ? "bg-glow-blue/15 text-foreground"
                    : "text-muted-foreground hover:bg-glow-blue/10 hover:text-foreground",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(index)}
              >
                <span className="flex size-5 items-center justify-center text-label-blue">
                  {command.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{command.prefix}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <textarea
        ref={textarea}
        aria-label="Ask Quill"
        aria-describedby={hintId}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onValueChange(next);
          if (next.startsWith("/") && !next.includes(" "))
            setActive(commands.findIndex((c) => c.prefix.startsWith(next.toLowerCase())));
        }}
        onKeyDown={onKeyDown}
        maxLength={2000}
        rows={1}
        placeholder={placeholder}
        style={{ height: MIN_HEIGHT }}
        className="block w-full resize-none bg-transparent px-5 pt-3.5 pb-1 text-[0.9375rem] leading-6 text-foreground outline-none placeholder:text-muted-foreground/70"
      />

      <div className="flex items-center gap-2 px-3 pt-1 pb-3">
        <Tip label="Example questions (type /)" side="top">
          <Button
            ref={commandButton}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Show example questions"
            aria-expanded={showPalette}
            onClick={() => setPaletteOpen((open) => !open)}
          >
            <Command />
          </Button>
        </Tip>
        {/* Optional: a budget that is added to the message as "Budget: N USDC." */}
        <label className="flex h-8 items-center gap-1 rounded-full border border-input px-3 font-mono text-xs text-muted-foreground transition-colors duration-200 focus-within:border-label-blue focus-within:text-foreground hover:border-label-blue/50">
          <span aria-hidden>$</span>
          <span className="sr-only">Budget in USDC (optional)</span>
          <input
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              send();
            }}
            placeholder="amount"
            className="w-14 bg-transparent text-foreground tabular-nums outline-none placeholder:text-muted-foreground/70"
          />
        </label>
        <p id={hintId} className="ml-auto hidden text-xs text-muted-foreground sm:block">
          <kbd className="font-mono">Enter</kbd> to send ·{" "}
          <kbd className="font-mono">Shift+Enter</kbd> for a new line
        </p>
        {/* Send, which becomes Stop while a reply streams. */}
        <Button
          type="button"
          size="icon"
          className="ml-auto rounded-full sm:ml-0"
          aria-label={busy ? "Stop the reply" : "Send"}
          disabled={!busy && !canSend}
          onClick={busy ? onStop : send}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={busy ? "stop" : "send"}
              initial={reduce ? false : { scale: 0.4, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={reduce ? undefined : { scale: 0.4, opacity: 0, rotate: 45 }}
              transition={{ duration: 0.16 }}
              className="inline-flex"
            >
              {busy ? <Square className="size-3.5 fill-current" /> : <ArrowUp />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}

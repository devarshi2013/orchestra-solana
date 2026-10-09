"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { Command, LoaderIcon, SendIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * An animated chat composer (adapted from the "animated AI chat" pattern):
 * glowing backdrop, a glass input card that grows with its text, a "/"
 * command palette and suggestion chips. Presentational and controlled: the
 * caller owns the value and decides what sending does.
 */

export type ChatCommand = {
  icon: React.ReactNode;
  label: string;
  /** Typed after "/" to pick it, e.g. "/tech". */
  prefix: string;
  /** The text the command puts in the input. */
  prompt: string;
};

function useAutoResizeTextarea(minHeight: number, maxHeight: number) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = `${minHeight}px`;
      if (reset) return;
      textarea.style.height = `${Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight))}px`;
    },
    [minHeight, maxHeight],
  );
  useEffect(() => {
    const onResize = () => adjustHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [adjustHeight]);
  return { textareaRef, adjustHeight };
}

/** The soft colour blobs behind the chat. */
export function ChatGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_72%)]",
        className,
      )}
    >
      <div className="absolute top-0 left-1/4 size-96 animate-pulse rounded-full bg-primary/8 blur-[128px]" />
      <div className="absolute right-1/4 bottom-0 size-96 animate-pulse rounded-full bg-gold/10 blur-[128px] delay-700" />
      <div className="absolute top-1/4 right-1/3 size-64 animate-pulse rounded-full bg-primary/5 blur-[96px] delay-1000" />
    </div>
  );
}

/** The animated "How can I help today?" heading. */
export function ChatHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-3 text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="inline-block"
      >
        <h2 className="pb-1 font-serif text-3xl font-medium tracking-tight text-heading">
          {title}
        </h2>
        <motion.div
          className="h-px bg-linear-to-r from-transparent via-gold/50 to-transparent"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "100%", opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        />
      </motion.div>
      {subtitle && (
        <motion.p
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

export function AnimatedChatInput({
  value,
  onValueChange,
  onSend,
  busy,
  commands,
  placeholder,
  actions,
  showChips = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
  commands: ChatCommand[];
  placeholder?: string;
  /** Extra buttons in the toolbar, next to the command button. */
  actions?: React.ReactNode;
  /** Show the commands as chips under the input. */
  showChips?: boolean;
}) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea(60, 200);
  const [active, setActive] = useState(-1);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const commandButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  // The cursor glow follows the mouse through motion values: no re-render per move.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useSpring(mouseX, { damping: 25, stiffness: 150, mass: 0.5 });
  const glowY = useSpring(mouseY, { damping: 25, stiffness: 150, mass: 0.5 });
  useEffect(() => {
    if (reduceMotion) return;
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX - 400);
      mouseY.set(e.clientY - 400);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY, reduceMotion]);

  // "/" + letters opens the palette on the first matching command.
  const typingCommand = value.startsWith("/") && !value.includes(" ");
  const showPalette = paletteOpen || typingCommand;

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!paletteRef.current?.contains(target) && !commandButtonRef.current?.contains(target)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (index: number) => {
    const command = commands[index];
    if (!command) return;
    onValueChange(command.prompt);
    setPaletteOpen(false);
    requestAnimationFrame(() => {
      adjustHeight();
      textareaRef.current?.focus();
    });
  };

  const send = () => {
    if (!value.trim() || busy) return;
    onSend(value);
    requestAnimationFrame(() => adjustHeight(true));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPalette && commands.length > 0) {
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

  return (
    <div className="relative w-full space-y-4">
      <motion.div
        className="relative rounded-2xl border border-border bg-card/95 shadow-lift backdrop-blur-xl focus-within:border-primary/40"
        initial={reduceMotion ? false : { scale: 0.98 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <AnimatePresence>
          {showPalette && commands.length > 0 && (
            <motion.div
              ref={paletteRef}
              role="listbox"
              aria-label="Commands"
              className="absolute right-4 bottom-full left-4 z-50 mb-2 overflow-hidden rounded-lg border border-border bg-popover/95 shadow-lift backdrop-blur-xl"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
            >
              <div className="py-1">
                {commands.map((command, index) => (
                  <motion.div
                    key={command.prefix}
                    role="option"
                    aria-selected={active === index}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors",
                      active === index
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(index)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <span className="flex size-5 items-center justify-center">{command.icon}</span>
                    <span className="font-medium">{command.label}</span>
                    <span className="ml-1 text-muted-foreground/70">{command.prefix}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-4">
          <textarea
            ref={textareaRef}
            aria-label="Ask the assistant"
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              onValueChange(next);
              if (next.startsWith("/") && !next.includes(" ")) {
                setActive(commands.findIndex((c) => c.prefix.startsWith(next.toLowerCase())));
              }
              adjustHeight();
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={2000}
            placeholder={placeholder}
            style={{ height: 60, overflow: "hidden" }}
            className="w-full resize-none border-none bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border p-3">
          <div className="flex items-center gap-1">
            <motion.button
              ref={commandButtonRef}
              type="button"
              aria-label="Show commands"
              aria-expanded={showPalette}
              title="Commands (type /)"
              onClick={() => setPaletteOpen((open) => !open)}
              whileTap={{ scale: 0.94 }}
              className={cn(
                "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                showPalette && "bg-muted text-foreground",
              )}
            >
              <Command className="size-4" />
            </motion.button>
            {actions}
          </div>

          <motion.button
            type="button"
            onClick={send}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={busy || !value.trim()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-[background-color,box-shadow,translate] duration-300 ease-in-out",
              value.trim() && !busy
                ? "bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover hover:shadow-hover motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0"
                : "bg-primary/45 text-primary-foreground",
            )}
          >
            {busy ? (
              <LoaderIcon className="size-4 animate-[spin_2s_linear_infinite]" />
            ) : (
              <SendIcon className="size-4" />
            )}
            Send
          </motion.button>
        </div>
      </motion.div>

      {showChips && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {commands.map((command, index) => (
            <motion.button
              key={command.prefix}
              type="button"
              onClick={() => pick(index)}
              className="flex items-center gap-2 rounded-lg border border-primary bg-card px-3.5 py-2 text-sm font-medium text-primary-text transition-[background-color,color,box-shadow,translate] duration-300 ease-in-out hover:bg-primary hover:text-primary-foreground hover:shadow-hover motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {command.icon}
              {command.label}
            </motion.button>
          ))}
        </div>
      )}

      {focused && !reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 -z-10 size-[50rem] rounded-full bg-linear-to-r from-primary via-gold to-primary opacity-[0.04] blur-[96px]"
          style={{ x: glowX, y: glowY }}
        />
      )}
    </div>
  );
}

/** Three pulsing dots, e.g. while the assistant is thinking. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("ml-1 inline-flex items-center", className)} aria-hidden>
      {[1, 2, 3].map((dot) => (
        <motion.span
          key={dot}
          className="mx-0.5 size-1.5 rounded-full bg-primary"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

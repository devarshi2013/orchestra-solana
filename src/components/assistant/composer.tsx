"use client";

import { ArrowUp, Square } from "lucide-react";
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 200;

/**
 * The chat's input: one white surface, a text area that grows with its text
 * (Enter sends, Shift+Enter adds a line) and a round button that sends, or
 * stops the reply while one streams. Controlled: the caller owns the text.
 */
export function Composer({
  value,
  onValueChange,
  onSend,
  onStop,
  busy,
  inputId,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (text: string) => void;
  /** Stops the reply streaming now. */
  onStop: () => void;
  busy: boolean;
  /** The text box's id, for a caller that focuses it. */
  inputId?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback((reset?: boolean) => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = `${MIN_HEIGHT}px`;
    if (!reset)
      el.style.height = `${Math.max(MIN_HEIGHT, Math.min(el.scrollHeight, MAX_HEIGHT))}px`;
  }, []);
  // The text can change from outside (a new chat, a pre-fill): keep the height in step.
  useEffect(() => resize(), [value, resize]);

  const send = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    requestAnimationFrame(() => resize(true));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const canSend = value.trim() !== "" && !busy;

  return (
    <div className="flex items-end gap-2 rounded-[20px] bg-white p-2 pl-4 shadow-hairline transition-shadow duration-150 focus-within:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_2px_8px_-2px_rgb(0_0_0/0.12)]">
      <textarea
        ref={textarea}
        id={inputId}
        aria-label="Message"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={2000}
        rows={1}
        placeholder="Ask anything"
        style={{ height: MIN_HEIGHT }}
        className="block min-w-0 flex-1 resize-none bg-transparent py-3 text-[15px] leading-6 tracking-[-0.01em] text-text-extra-high outline-none placeholder:text-ink-muted"
      />
      <button
        type="button"
        aria-label={busy ? "Stop the reply" : "Send"}
        disabled={!busy && !canSend}
        onClick={busy ? onStop : send}
        className={cn(
          "mb-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-gray-1200 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-default",
          busy || canSend ? "bg-gray-1400 text-white hover:bg-gray-1300" : "bg-soft text-ink-muted",
        )}
      >
        {busy ? <Square className="size-3 fill-current" /> : <ArrowUp className="size-4.5" />}
      </button>
    </div>
  );
}

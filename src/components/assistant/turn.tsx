"use client";

import { TriangleAlert } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { AssistantTurn } from "@/hooks/use-agent-chat";
import { buyableFrom } from "@/lib/assistant/buyable";

import { BuyProvider } from "./buy";

import { DataUsed, sourcesOf, trailLabel } from "./data-used";
import { Markdown } from "./markdown";

/** A progress note as plain text: Markdown marks (**, #, `) would show literally here. */
function plainNote(text: string): string {
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EMPTY = new Map<string, string[]>();

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

/** Your message: a bubble on the right, on the soft fill. */
export function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-[6px] bg-soft px-4 py-2.5 text-[15px] leading-[1.45] tracking-[-0.01em] whitespace-pre-wrap text-text-extra-high">
      {text}
    </div>
  );
}

/**
 * What the assistant is doing right now, as one muted line: the tool call in
 * flight, else its own progress note, else "Thinking".
 */
function Status({ turn }: { turn: AssistantTurn }) {
  const running = turn.tools.findLast((t) => t.ok === null);
  const label = running
    ? trailLabel(running.name, running.input)
    : turn.progress
      ? plainNote(turn.progress)
      : turn.tools.length > 0
        ? "Reading the results"
        : "Thinking";
  return (
    <p role="status" aria-live="polite" className="text-shimmer text-[13px] tracking-[-0.01em]">
      {label}…
    </p>
  );
}

/**
 * One answer: the data it used (chips), the live trail while it works, the
 * reply as plain text, then `cards` (the trade ticket), any error, and a line
 * naming its sources.
 */
export function AssistantTurnView({ turn, cards }: { turn: AssistantTurn; cards?: ReactNode }) {
  const sources = sourcesOf(turn.tools);
  // Buy pills only once the reply is complete, and only for what its tools returned.
  const buyable = useMemo(
    () => (turn.done ? buyableFrom(turn.tools) : undefined),
    [turn.done, turn.tools],
  );
  return (
    <article
      aria-label="Reply"
      className="space-y-4 text-[15px] leading-[1.6] tracking-[-0.01em] text-text-extra-high"
    >
      <DataUsed tools={turn.tools} />
      {!turn.done && (!turn.text || turn.tools.some((t) => t.ok === null)) && (
        <Status turn={turn} />
      )}
      {turn.text && (
        <BuyProvider buyable={buyable ?? EMPTY}>
          <Markdown text={turn.text} streaming={!turn.done} buyable={buyable} />
        </BuyProvider>
      )}
      {cards}
      {turn.error && (
        <p role="alert" className="flex items-center gap-1.5 text-[14px] text-status-error-text">
          <TriangleAlert className="size-4 shrink-0" aria-hidden /> {turn.error}
        </p>
      )}
      {turn.done && turn.text && (
        <p className="text-[12.5px] text-ink-muted tabular-nums">
          {[sources.join(" · "), turn.at && clock(turn.at)].filter(Boolean).join(" · ")}
        </p>
      )}
    </article>
  );
}

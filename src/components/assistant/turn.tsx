"use client";

import { Check, Loader2, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { AssistantTurn } from "@/hooks/use-agent-chat";
import { cn } from "@/lib/utils";

import { DataUsed, sourcesOf, trailLabel } from "./data-used";
import { Markdown } from "./markdown";

/** A progress note as plain text: Markdown marks (**, #, `) would show literally here. */
export function plainNote(text: string): string {
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The longest opening sentence that still reads as a headline. */
const MAX_LEAD = 160;

/**
 * Splits a reply into its lead (the opening sentence, shown in the heading
 * font) and the rest. There is a lead only when the reply opens with a plain
 * sentence: not a heading, list, table, quote or code, and nothing with a link.
 */
export function splitLead(text: string): { lead: string | null; body: string } {
  const trimmed = text.trimStart();
  const firstLine = trimmed.split("\n", 1)[0] ?? "";
  if (
    !firstLine ||
    /^(#{1,6}\s|[-*+>|]|\d+[.)]\s|```|~~~)/.test(firstLine) ||
    /[[\]<]/.test(firstLine)
  )
    return { lead: null, body: text };
  const end = firstLine.search(/[.!?](\s|$)/);
  if (end < 0 || end + 1 > MAX_LEAD) return { lead: null, body: text };
  return { lead: plainNote(firstLine.slice(0, end + 1)), body: trimmed.slice(end + 1).trimStart() };
}

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

/** Your message: a compact pill on the right, in the accent colour. */
export function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto w-fit max-w-[85%] rounded-[1.25rem] rounded-br-md bg-glow-blue px-4 py-2 text-sm leading-6 whitespace-pre-wrap text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]">
      {text}
    </div>
  );
}

/**
 * What the assistant is doing, built from its REAL tool calls as they happen:
 * each call is a step that ticks when its result arrives (or is crossed when
 * it fails), then "Writing the note" while the answer streams.
 */
function ResearchTrail({ turn }: { turn: AssistantTurn }) {
  const running = turn.tools.some((t) => t.ok === null);
  const steps: { id: string; label: string; state: "done" | "running" | "failed" }[] =
    turn.tools.map((t) => ({
      id: t.id,
      label: trailLabel(t.name, t.input),
      state: t.ok === null ? "running" : t.ok ? "done" : "failed",
    }));
  if (!running)
    steps.push({
      id: "write",
      label: turn.text
        ? "Writing the note"
        : turn.tools.length > 0
          ? "Reading the results"
          : "Reading your question",
      state: "running",
    });
  return (
    <div role="status" aria-live="polite" className="space-y-1.5">
      <ol className="space-y-1.5 text-xs">
        {steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              "flex items-start gap-2 motion-safe:animate-row-in",
              step.state === "running" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "mt-px flex size-4 shrink-0 items-center justify-center rounded-full border",
                step.state === "done" && "border-gain/50 bg-gain/15 text-gain",
                step.state === "failed" && "border-danger/50 bg-danger/15 text-danger",
                step.state === "running" && "border-label-blue/50 text-label-blue",
              )}
            >
              {step.state === "done" ? (
                <Check className="size-2.5" aria-label="Done" />
              ) : step.state === "failed" ? (
                <X className="size-2.5" aria-label="Failed" />
              ) : (
                <Loader2 className="size-2.5 animate-spin" aria-label="In progress" />
              )}
            </span>
            {step.label}
            {step.state === "running" && "…"}
          </li>
        ))}
      </ol>
      {/* The assistant's own note on what it is doing, when it sends one. */}
      {turn.progress && (
        <p className="pl-6 text-xs text-muted-foreground">{plainNote(turn.progress)}</p>
      )}
    </div>
  );
}

/**
 * One answer as a research note: the data it used (chips), the live trail
 * while it works, a lead sentence in the heading font and the body, then
 * `cards` (the trade ticket), any error, and a line naming its sources.
 */
export function AssistantTurnView({ turn, cards }: { turn: AssistantTurn; cards?: ReactNode }) {
  const { lead, body } = splitLead(turn.text);
  const sources = sourcesOf(turn.tools);
  return (
    <article
      aria-label="Research note"
      className="relative space-y-4 border-l border-label-blue/30 pl-4 text-sm sm:pl-6"
    >
      {/* The note's marker on its rule. */}
      <span
        aria-hidden
        className="absolute top-1 -left-[4.5px] size-2 rounded-full bg-label-blue shadow-[0_0_0_4px_var(--background)]"
      />
      <DataUsed tools={turn.tools} />
      {!turn.done && <ResearchTrail turn={turn} />}
      {!turn.done && !turn.text && (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      )}
      {turn.text && (
        <div className="space-y-3">
          {lead && (
            <p className="font-heading text-lg leading-snug font-semibold tracking-tight text-foreground sm:text-xl">
              {lead}
            </p>
          )}
          {body && <Markdown text={body} streaming={!turn.done} />}
        </div>
      )}
      {cards}
      {turn.error && (
        <p role="alert" className="flex items-center gap-1.5 text-danger">
          <TriangleAlert className="size-4 shrink-0" aria-hidden /> {turn.error}
        </p>
      )}
      {turn.done && turn.text && (
        <p className="border-t pt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
          {sources.length > 0 ? `Sources: ${sources.join(" · ")}` : "No live data was used"}
          {turn.at ? ` · as of ${clock(turn.at)}` : ""}
        </p>
      )}
    </article>
  );
}

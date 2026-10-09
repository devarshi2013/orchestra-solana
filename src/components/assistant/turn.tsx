"use client";

import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { TypingDots } from "@/components/ui/animated-ai-chat";
import type { AssistantTurn } from "@/hooks/use-agent-chat";

import { DataUsed, describeTool } from "./data-used";
import { Markdown } from "./markdown";

/** What the assistant is doing right now: its latest note, else the running tool call. */
function liveStatus(turn: AssistantTurn): string {
  if (turn.progress) return turn.progress;
  const running = [...turn.tools].reverse().find((t) => t.ok === null);
  return running ? describeTool(running.name, running.input) : "Thinking";
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
      {text}
    </div>
  );
}

/** One answer: live status, text, the data it used, then `cards` (plans, proposals), then any error. */
export function AssistantTurnView({ turn, cards }: { turn: AssistantTurn; cards?: ReactNode }) {
  return (
    <div className="space-y-3 text-sm">
      {!turn.done && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {liveStatus(turn)} <TypingDots />
        </p>
      )}
      {turn.text && <Markdown text={turn.text} />}
      <DataUsed tools={turn.tools} />
      {cards}
      {turn.error && (
        <p className="flex items-center gap-1.5 text-destructive">
          <TriangleAlert className="size-4" /> {turn.error}
        </p>
      )}
    </div>
  );
}

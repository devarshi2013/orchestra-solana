"use client";

import { useState } from "react";

import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseSymphony } from "@/lib/symphony/serialize";
import type { Symphony } from "@/lib/symphony/types";

/** Raw JSON view of the draft. Edits apply only when they parse as a symphony. */
export function JsonEditor({
  symphony,
  onApply,
}: {
  symphony: Symphony;
  onApply: (symphony: Symphony) => void;
}) {
  const original = JSON.stringify(symphony, null, 2);
  const [text, setText] = useState(original);
  const parsed = parseSymphony(text);
  const changed = text !== original;

  return (
    <div className="space-y-3">
      <Textarea
        aria-label="Symphony JSON"
        aria-invalid={!parsed.ok || undefined}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-[32rem] font-mono text-xs"
      />
      {!parsed.ok && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/6 px-3 py-2 text-sm text-destructive"
          aria-live="polite"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <CircleAlert className="size-4 shrink-0" aria-hidden /> {parsed.error}
          </span>
          {parsed.issues && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {parsed.issues.slice(0, 5).map((issue) => (
                <li key={issue.path.join(".") + issue.message}>
                  {issue.path.length ? `${issue.path.join(".")}: ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!parsed.ok || !changed}
          onClick={() => parsed.ok && onApply(parsed.symphony)}
        >
          Apply JSON
        </Button>
        <Button variant="outline" disabled={!changed} onClick={() => setText(original)}>
          Revert
        </Button>
      </div>
    </div>
  );
}

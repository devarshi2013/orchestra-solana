"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
    <div className="space-y-2">
      <textarea
        aria-label="Symphony JSON"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-[32rem] w-full resize-y rounded-lg border bg-transparent p-3 font-mono text-xs leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      {!parsed.ok && (
        <div className="text-sm text-destructive" aria-live="polite">
          {parsed.error}
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
      <div className="flex gap-2">
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

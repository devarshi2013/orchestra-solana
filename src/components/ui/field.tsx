import * as React from "react";
import { cn } from "cn";
import { CircleAlert } from "lucide-react";

import { Label } from "./label";

/**
 * A labelled form field: label, the control (children), then a hint or an
 * inline error. Give the control `id={id}`; the error is announced and linked
 * with aria-describedby by the caller via `${id}-message`.
 */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="field" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p
          id={`${id}-message`}
          className="flex items-center gap-1 text-xs text-destructive"
          aria-live="polite"
        >
          <CircleAlert className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-message`} className="type-caption">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "warning" | "info";
type ToastItem = { id: number; tone: Tone; title: string; description?: string };

/**
 * Minimal toasts: `toast.success("Saved")` from anywhere on the client;
 * <Toaster /> (in the root layout) shows them in a polite live region and
 * dismisses each after a few seconds.
 */
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function show(tone: Tone, title: string, description?: string) {
  const id = nextId++;
  items = [...items.slice(-3), { id, tone, title, description }];
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
}

export const toast = {
  success: (title: string, description?: string) => show("success", title, description),
  error: (title: string, description?: string) => show("error", title, description),
  warning: (title: string, description?: string) => show("warning", title, description),
  info: (title: string, description?: string) => show("info", title, description),
};

const ICONS = { success: CheckCircle2, error: XCircle, warning: TriangleAlert, info: Info };
const TONE = {
  success: "text-success",
  error: "text-destructive",
  warning: "text-warning",
  info: "text-primary-text",
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const EMPTY: ToastItem[] = [];

export function Toaster() {
  const toasts = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lift"
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[t.tone])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 type-caption">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

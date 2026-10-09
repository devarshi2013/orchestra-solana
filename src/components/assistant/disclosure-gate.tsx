"use client";

import { ShieldAlert } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ASSISTANT_DISCLOSURE_VERSION, DISCLOSURE_POINTS } from "@/lib/assistant/disclosure";

// Kept from before the rename to Askfirst, so returning users aren't asked again.
const KEY = `orchestra-disclosure-v${ASSISTANT_DISCLOSURE_VERSION}`;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const readAccepted = () => {
  try {
    return localStorage.getItem(KEY) === "accepted";
  } catch {
    return false;
  }
};

/**
 * Shows the assistant only once this browser has accepted the risk
 * disclosure (remembered locally; bumping ASSISTANT_DISCLOSURE_VERSION asks
 * again).
 */
export function DisclosureGate({ children }: { children: ReactNode }) {
  // null while server rendering, so the page never flashes the wrong state.
  const accepted = useSyncExternalStore<boolean | null>(subscribe, readAccepted, () => null);
  const [checked, setChecked] = useState(false);
  const [sessionAccepted, setSessionAccepted] = useState(false);

  const accept = () => {
    try {
      localStorage.setItem(KEY, "accepted");
    } catch {
      // Storage blocked (private mode): accept for this page view only.
      setSessionAccepted(true);
    }
    listeners.forEach((l) => l());
  };

  if (accepted || sessionAccepted) return <>{children}</>;
  if (accepted === null) return <Skeleton className="h-64 w-full" />;
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-5" /> Before you use the assistant
        </CardTitle>
        <CardDescription>Please read and accept this once.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3 text-sm">
          {DISCLOSURE_POINTS.map((point) => (
            <li key={point.title}>
              <p className="font-medium">{point.title}</p>
              <p className="text-muted-foreground">{point.text}</p>
            </li>
          ))}
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          I understand the AI can be wrong, its plans aren&apos;t financial advice, tokenized stocks
          are securities I must be eligible to buy, and I can lose money.
        </label>
        <Button onClick={accept} disabled={!checked}>
          Accept and continue
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { ShieldAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantApi } from "@/lib/api-client";
import { DISCLOSURE_POINTS } from "@/lib/assistant/disclosure";

/**
 * Shows the assistant only once the wallet has accepted the risk disclosure
 * (once per wallet, stored server-side; the API refuses chats and purchases
 * without it).
 */
export function DisclosureGate({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    assistantApi
      .disclosure()
      .then((result) => !cancelled && setAccepted(result.accepted))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await assistantApi.acceptDisclosure();
      setAccepted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (accepted) return <>{children}</>;
  if (accepted === null && !error) return <Skeleton className="h-64 w-full" />;
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
          are securities I must be eligible to buy, and crypto is volatile.
        </label>
        <Button onClick={() => void accept()} disabled={!checked || busy}>
          {busy ? "Saving…" : "Accept and continue"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

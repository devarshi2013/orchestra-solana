"use client";

import { LogIn } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useWalletSession } from "@/hooks/use-wallet-session";

/** Renders children only for a signed-in wallet that is also the connected one. */
export function SignInGate({ children }: { children: ReactNode }) {
  const { connected, signedIn, loading, busy, error, signIn } = useWalletSession();
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (signedIn) return <>{children}</>;
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{connected ? "Sign in with your wallet" : "Connect your wallet"}</CardTitle>
        <CardDescription>
          {connected
            ? "Sign a short message to prove this wallet is yours. It doesn't move funds or approve any transaction."
            : "Investing uses the tokens in your own wallet. Every trade is signed by you; Orchestra never holds funds."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <Button onClick={signIn} disabled={busy}>
            <LogIn /> {busy ? "Waiting for your wallet…" : "Sign in"}
          </Button>
        ) : (
          <WalletButton />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletButton } from "@/components/wallet/wallet-button";

/**
 * Shows its children once a wallet is connected. Connecting only shares the
 * wallet's public address (for balances and quotes); there's no sign-in, and
 * nothing moves without approving each swap in the wallet.
 */
export function WalletGate({ children }: { children: ReactNode }) {
  const { connected } = useWallet();
  if (connected) return <>{children}</>;
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-5" /> Connect your wallet
        </CardTitle>
        <CardDescription>
          The assistant reads your USDC balance and quotes trades for your wallet. Connecting only
          shares its public address: every buy still needs your approval in the wallet, and
          Orchestra never holds funds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WalletButton />
      </CardContent>
    </Card>
  );
}

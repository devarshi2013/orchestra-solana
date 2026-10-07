"use client";

import "@solana/wallet-adapter-react-ui/styles.css";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { ReactNode } from "react";

import { clientEnv } from "@/env/client";

/**
 * Phantom, Backpack and Jupiter Wallet all implement the Wallet Standard, so
 * they are auto-detected; no per-wallet adapter packages are needed. The
 * wallet only ever signs — transactions are sent via our /api routes to
 * Jupiter's /execute.
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={clientEnv.NEXT_PUBLIC_SOLANA_RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

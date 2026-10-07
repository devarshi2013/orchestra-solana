"use client";

import "@solana/wallet-adapter-react-ui/styles.css";

import {
  WalletAccountError,
  WalletNotReadyError,
  type Adapter,
  type WalletError,
} from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { ReactNode } from "react";

import { clientEnv } from "@/env/client";

/**
 * Without a handler the adapter `console.error`s every failure, which the Next
 * dev overlay shows as a crash. The provider already resets the selected
 * wallet on connect errors, so here we only make the message actionable.
 */
function handleWalletError(error: WalletError, adapter?: Adapter) {
  if (error instanceof WalletAccountError) {
    // The wallet approved `connect` but exposed no Solana account: it is
    // locked, has no Solana account, or the silent auto-connect wasn't trusted.
    console.warn(
      `${adapter?.name ?? "Wallet"} returned no Solana account. Unlock it, make sure a Solana account is enabled, then connect again.`,
    );
    return;
  }
  if (error instanceof WalletNotReadyError && adapter) {
    // Keep the library's default: send the user to install the wallet.
    window.open(adapter.url, "_blank");
    return;
  }
  console.error(error, adapter);
}

/**
 * Phantom, Backpack and Jupiter Wallet all implement the Wallet Standard, so
 * they are auto-detected; no per-wallet adapter packages are needed. The
 * wallet only ever signs — transactions are sent via our /api routes to
 * Jupiter's /execute.
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={clientEnv.NEXT_PUBLIC_SOLANA_RPC_URL}>
      <WalletProvider wallets={[]} autoConnect onError={handleWalletError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

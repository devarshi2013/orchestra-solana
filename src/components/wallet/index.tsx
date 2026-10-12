"use client";

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { useMemo, type ReactNode } from "react";

import { ConnectWalletDrawer } from "@/components/wallet/connect-wallet-drawer";
import { useWalletContext, WalletProvider } from "@/components/wallet/wallet-provider";
import { clientEnv } from "@/env";
import { useWalletModalStore } from "@/stores/wallet-modal";

export { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
export { WalletButton } from "@/components/wallet/wallet-button";

/** The wallet (Wallet Standard, as in perps) and its connect drawer, mounted once at the root. */
export function WalletRoot({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      {children}
      <WalletDrawer />
    </WalletProvider>
  );
}

function WalletDrawer() {
  const open = useWalletModalStore((s) => s.open);
  const setOpen = useWalletModalStore((s) => s.setOpen);
  return <ConnectWalletDrawer open={open} onOpenChange={setOpen} />;
}

/**
 * The connected wallet in the shape the app's trade code uses: a web3.js
 * public key, and signTransaction for a VersionedTransaction (the wallet
 * signs the serialized bytes; the app never sends from it).
 */
export function useWallet() {
  const {
    wallet,
    account,
    status,
    disconnect,
    signMessage,
    signTransaction: signBytes,
  } = useWalletContext();
  const publicKey = useMemo(() => (account ? new PublicKey(account.publicKey) : null), [account]);
  const canSign = Boolean(wallet?.features["solana:signTransaction"] && account);
  const signTransaction = useMemo(
    () =>
      canSign
        ? async <T extends VersionedTransaction>(transaction: T): Promise<T> =>
            VersionedTransaction.deserialize(await signBytes(transaction.serialize())) as T
        : undefined,
    [canSign, signBytes],
  );
  return {
    publicKey,
    connected: status === "connected",
    connecting: status === "connecting",
    wallet: wallet ? { name: wallet.name, icon: wallet.icon } : null,
    signTransaction,
    /** Signs raw message bytes (e.g. the sign-in message); throws if the wallet can't. */
    signMessage,
    disconnect,
  };
}

let connection: Connection | null = null;

/** The browser's Solana RPC connection (NEXT_PUBLIC_SOLANA_RPC_URL). */
export function useConnection() {
  connection ??= new Connection(clientEnv.NEXT_PUBLIC_SOLANA_RPC_URL, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });
  return { connection };
}

/** Opens the connect-wallet drawer. */
export function useWalletModal() {
  return { setVisible: useWalletModalStore((s) => s.setOpen) };
}

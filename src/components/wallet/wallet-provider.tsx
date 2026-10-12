"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useWallets } from "@/hooks/use-wallets";
import { STORAGE_WALLET_NAME } from "@/lib/constants";
import { requireFeature } from "@/lib/wallet";
import type {
  ConnectFeature,
  DisconnectFeature,
  EventsFeature,
  SignMessageFeature,
  SignTransactionFeature,
  WalletAccount,
  WalletContextValue,
  WalletStandardWallet,
  WalletStatus,
} from "@/types/wallet";

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const detected = useWallets();
  const wallets = useMemo(() => {
    const seen = new Set<string>();
    return detected.filter(
      (w) =>
        w.chains.some((c) => c.startsWith("solana:")) && !seen.has(w.name) && !!seen.add(w.name),
    );
  }, [detected]);

  const [wallet, setWallet] = useState<WalletStandardWallet | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const teardown = useRef<(() => void) | null>(null);
  const autoConnectAttempted = useRef(false);

  const reset = useCallback(() => {
    teardown.current?.();
    teardown.current = null;
    setWallet(null);
    setAccount(null);
    setStatus("disconnected");
    window.localStorage.removeItem(STORAGE_WALLET_NAME);
  }, []);

  const setConnected = useCallback(
    (target: WalletStandardWallet, accounts: readonly WalletAccount[]) => {
      teardown.current?.();
      const events = target.features["standard:events"] as EventsFeature | undefined;
      teardown.current =
        events?.on("change", ({ accounts: next }) => {
          if (!next) return;
          if (next.length === 0) reset();
          else setAccount(next[0] ?? null);
        }) ?? null;
      setWallet(target);
      setAccount(accounts[0] ?? null);
      setStatus("connected");
    },
    [reset],
  );

  const connect = useCallback(
    async (target: WalletStandardWallet) => {
      setStatus("connecting");
      try {
        const feature = requireFeature<ConnectFeature>(target, "standard:connect");
        const { accounts } = await feature.connect();
        if (accounts.length === 0) throw new Error("No accounts returned");
        setConnected(target, accounts);
        window.localStorage.setItem(STORAGE_WALLET_NAME, target.name);
      } catch (err) {
        setStatus("disconnected");
        throw err;
      }
    },
    [setConnected],
  );

  const disconnect = useCallback(async () => {
    const current = wallet;
    reset();
    if (!current) return;
    await (current.features["standard:disconnect"] as DisconnectFeature | undefined)?.disconnect();
  }, [wallet, reset]);

  useEffect(() => {
    if (autoConnectAttempted.current || wallet) return;
    const lastName = window.localStorage.getItem(STORAGE_WALLET_NAME);
    const target = lastName ? wallets.find((w) => w.name === lastName) : undefined;
    const feature = target?.features["standard:connect"] as ConnectFeature | undefined;
    if (!target || !feature) return;
    autoConnectAttempted.current = true;
    // The silent auto-connect starts here, once per page load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("connecting");
    feature
      .connect({ silent: true })
      .then(({ accounts }) =>
        accounts.length ? setConnected(target, accounts) : setStatus("disconnected"),
      )
      .catch(() => setStatus("disconnected"));
  }, [wallets, wallet, setConnected]);

  const signMessage = useCallback(
    async (message: Uint8Array) => {
      if (!wallet || !account) throw new Error("Wallet not connected");
      const feature = requireFeature<SignMessageFeature>(wallet, "solana:signMessage");
      const [result] = await feature.signMessage({ account, message });
      if (!result) throw new Error(`${wallet.name} returned no signature`);
      return result.signature;
    },
    [wallet, account],
  );

  const signTransaction = useCallback(
    async (transaction: Uint8Array, chain = "solana:mainnet") => {
      if (!wallet || !account) throw new Error("Wallet not connected");
      const feature = requireFeature<SignTransactionFeature>(wallet, "solana:signTransaction");
      const [result] = await feature.signTransaction({ account, transaction, chain });
      if (!result) throw new Error(`${wallet.name} returned no signed transaction`);
      return result.signedTransaction;
    },
    [wallet, account],
  );

  const value = useMemo<WalletContextValue>(
    () => ({ wallets, wallet, account, status, connect, disconnect, signMessage, signTransaction }),
    [wallets, wallet, account, status, connect, disconnect, signMessage, signTransaction],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used within WalletProvider");
  return ctx;
}

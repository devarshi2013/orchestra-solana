"use client";

import { useSyncExternalStore } from "react";

import type { WalletStandardWallet } from "@/types/wallet";

type Register = (wallet: WalletStandardWallet) => () => void;

let registry: readonly WalletStandardWallet[] = [];
const subscribers = new Set<() => void>();
let initialized = false;
const EMPTY: readonly WalletStandardWallet[] = [];

const register: Register = (wallet) => {
  registry = [...registry, wallet];
  subscribers.forEach((cb) => cb());
  return () => {
    registry = registry.filter((w) => w !== wallet);
    subscribers.forEach((cb) => cb());
  };
};

const initialize = () => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("wallet-standard:register-wallet", (e) =>
    (e as CustomEvent<(api: { register: Register }) => void>).detail({ register }),
  );
  window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: { register } }));
};

export function useWallets(): readonly WalletStandardWallet[] {
  return useSyncExternalStore(
    (cb) => {
      initialize();
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    () => registry,
    () => EMPTY,
  );
}

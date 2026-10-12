"use client";

import bs58 from "bs58";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { useWallet, useWalletModal } from "@/components/wallet";
import { authApi } from "@/lib/api-client";
import { useWalletModalStore } from "@/stores/wallet-modal";

/**
 * The wallet session (sign-in with the wallet), shared by every component:
 * read from /api/auth/me once, set by signIn (the wallet signs a one-time
 * message), and dropped when the connected wallet changes to another address.
 */

type Status = "loading" | "signed-out" | "signed-in";
type State = { wallet: string | null; status: Status };

let state: State = { wallet: null, status: "loading" };
let checked = false;
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const SERVER_STATE: State = { wallet: null, status: "loading" };

/** Resolved by the hook once the wallet drawer connects (or rejected when it closes without). */
let pendingConnect: { resolve: (address: string) => void; reject: (error: Error) => void } | null =
  null;

export function useSession() {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const drawerOpen = useWalletModalStore((s) => s.open);
  const address = publicKey?.toBase58() ?? null;
  // signIn may wait for a connect, so it signs with whichever wallet is current then.
  const sign = useRef(signMessage);
  useEffect(() => {
    sign.current = signMessage;
  }, [signMessage]);

  useEffect(() => {
    if (checked) return;
    checked = true;
    authApi
      .me()
      .then(({ wallet }) => set({ wallet, status: wallet ? "signed-in" : "signed-out" }))
      .catch((error: unknown) => {
        console.error("[session] couldn't read the session", error);
        set({ wallet: null, status: "signed-out" });
      });
  }, []);

  // A connect started by signIn finishes (or is abandoned) through the drawer.
  useEffect(() => {
    if (!pendingConnect) return;
    if (address) {
      pendingConnect.resolve(address);
      pendingConnect = null;
    } else if (!drawerOpen) {
      pendingConnect.reject(new Error("Wallet not connected"));
      pendingConnect = null;
    }
  }, [address, drawerOpen]);

  const signOut = useCallback(async () => {
    set({ wallet: null, status: "signed-out" });
    await authApi.logout();
  }, []);

  // The session belongs to one wallet: switching to another address signs out.
  useEffect(() => {
    if (address && state.wallet && address !== state.wallet) void signOut();
  }, [address, signOut]);

  const signIn = useCallback(async () => {
    const wallet =
      address ??
      (await new Promise<string>((resolve, reject) => {
        pendingConnect = { resolve, reject };
        setVisible(true);
      }));
    const { message } = await authApi.nonce(wallet);
    const signature = await sign.current(new TextEncoder().encode(message));
    await authApi.verify({ wallet, signature: bs58.encode(signature), message });
    set({ wallet, status: "signed-in" });
  }, [address, setVisible]);

  return { wallet: current.wallet, status: current.status, signIn, signOut };
}

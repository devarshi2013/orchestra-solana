"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";

import { authApi } from "@/lib/api-client";
import { bytesToBase64 } from "@/lib/solana";

/**
 * Sign-In With Solana for the connected wallet. `signedIn` only when the
 * server session belongs to the wallet that's connected right now.
 */
export function useWalletSession() {
  const { publicKey, signMessage } = useWallet();
  const connected = publicKey?.toBase58() ?? null;
  const [session, setSession] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi
      .session()
      .then((s) => setSession(s.wallet))
      .catch(() => setSession(null));
  }, []);

  const signIn = useCallback(async () => {
    if (!connected) return;
    if (!signMessage) {
      setError(
        "This wallet can't sign messages, so it can't sign in. Try Phantom, Solflare or Backpack.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { message } = await authApi.challenge(connected);
      const signature = await signMessage(new TextEncoder().encode(message));
      const { wallet } = await authApi.verify(connected, bytesToBase64(signature));
      setSession(wallet);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(/reject|declin|cancel/i.test(text) ? "You declined the sign-in request." : text);
    } finally {
      setBusy(false);
    }
  }, [connected, signMessage]);

  const signOut = useCallback(async () => {
    await authApi.signOut();
    setSession(null);
  }, []);

  return {
    connected,
    session,
    signedIn: Boolean(connected && session === connected),
    loading: session === undefined,
    busy,
    error,
    signIn,
    signOut,
  };
}

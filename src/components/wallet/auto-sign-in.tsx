"use client";

import { useEffect, useRef } from "react";

import { useWallet } from "@/components/wallet";
import { useSession } from "@/hooks/use-session";

/**
 * Signs in with the wallet as soon as it connects: once the session check
 * says there's no session for this wallet, it asks the wallet to sign the
 * sign-in message. One prompt per connection; declining isn't retried until
 * the wallet reconnects or changes.
 */
export function AutoSignIn() {
  const { publicKey } = useWallet();
  const { wallet, status, signIn } = useSession();
  const address = publicKey?.toBase58() ?? null;
  const prompted = useRef<string | null>(null);

  useEffect(() => {
    if (!address) {
      prompted.current = null;
      return;
    }
    if (status === "loading" || wallet === address || prompted.current === address) return;
    prompted.current = address;
    signIn().catch((error: unknown) => console.warn("[session] sign-in declined", error));
  }, [address, status, wallet, signIn]);

  return null;
}

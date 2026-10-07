"use client";

import dynamic from "next/dynamic";

// The wallet button reads browser-only wallet state; render it client-side to avoid hydration mismatches.
export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false, loading: () => <div className="h-10 w-36 rounded-md bg-muted" /> },
);

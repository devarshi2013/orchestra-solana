import type { Metadata } from "next";

import { AssistantChat } from "@/components/assistant/assistant-chat";
import { DisclosureGate } from "@/components/assistant/disclosure-gate";
import { WalletGate } from "@/components/assistant/wallet-gate";

export const metadata: Metadata = { title: "Stock assistant · Orchestra" };

export default function AssistantPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Stock assistant</h1>
        <p className="text-sm text-muted-foreground">
          Find tokenized US stocks on Solana with live data, see real Jupiter quotes, and buy from
          your own wallet: every swap waits for your approval.
        </p>
      </div>
      <WalletGate>
        <DisclosureGate>
          <AssistantChat />
        </DisclosureGate>
      </WalletGate>
    </main>
  );
}

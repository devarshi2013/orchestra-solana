import type { Metadata } from "next";

import { HistoryView } from "@/components/assistant/history-view";
import { SignInGate } from "@/components/invest/sign-in-gate";

export const metadata: Metadata = { title: "History · Orchestra" };

export default function HistoryPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          Plans you bought with the assistant and your chats, saved to this wallet.
        </p>
      </div>
      <SignInGate>
        <HistoryView />
      </SignInGate>
    </main>
  );
}

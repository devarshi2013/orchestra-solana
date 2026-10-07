import type { Metadata } from "next";

import { AssistantChat } from "@/components/assistant/assistant-chat";
import { SignInGate } from "@/components/invest/sign-in-gate";

export const metadata: Metadata = { title: "Assistant · Orchestra" };

export default function AssistantPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Research assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask about Orchestra&apos;s stocks and crypto, and get a plan for your USDC, built from
          live data.
        </p>
      </div>
      <SignInGate>
        <AssistantChat />
      </SignInGate>
    </main>
  );
}

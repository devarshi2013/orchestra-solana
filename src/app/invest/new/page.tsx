import type { Metadata } from "next";

import { NewInvestmentForm } from "@/components/invest/new-investment-form";
import { SignInGate } from "@/components/invest/sign-in-gate";

export const metadata: Metadata = { title: "New investment · Orchestra" };

export default function NewInvestmentPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
      <SignInGate>
        <NewInvestmentForm />
      </SignInGate>
    </main>
  );
}

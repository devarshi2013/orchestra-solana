import type { Metadata } from "next";
import Link from "next/link";

import { InvestmentList } from "@/components/invest/investment-list";
import { SignInGate } from "@/components/invest/sign-in-gate";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Invest · Orchestra" };

export default function InvestPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Invest</h1>
        <p className="text-sm text-muted-foreground">
          Run a symphony on your own wallet. Orchestra plans each rebalance and you sign every swap;
          funds never leave your control.
        </p>
      </div>
      <SignInGate>
        <div className="space-y-4">
          <InvestmentList />
          <Button asChild variant="outline">
            <Link href="/invest/new">New investment</Link>
          </Button>
        </div>
      </SignInGate>
    </main>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { InvestmentDetail } from "@/components/invest/investment-detail";
import { SignInGate } from "@/components/invest/sign-in-gate";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Investment · Orchestra" };

export default function InvestmentPage({ params }: PageProps<"/invest/[id]">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: { params: PageProps<"/invest/[id]">["params"] }) {
  const { id } = await params;
  return (
    <SignInGate>
      <InvestmentDetail id={id} />
    </SignInGate>
  );
}

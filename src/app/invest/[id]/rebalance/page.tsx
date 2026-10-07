import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { RebalanceReview } from "@/components/invest/rebalance-review";
import { SignInGate } from "@/components/invest/sign-in-gate";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Review & rebalance · Orchestra" };

export default function RebalancePage({ params }: PageProps<"/invest/[id]/rebalance">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Review params={params} />
      </Suspense>
    </main>
  );
}

async function Review({ params }: { params: PageProps<"/invest/[id]/rebalance">["params"] }) {
  const { id } = await params;
  return (
    <>
      <div className="space-y-1">
        <Link
          href={`/invest/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Investment
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Review &amp; rebalance</h1>
      </div>
      <SignInGate>
        <RebalanceReview investmentId={id} />
      </SignInGate>
    </>
  );
}

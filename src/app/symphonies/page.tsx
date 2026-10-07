import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { SymphonyEvaluations } from "./symphony-evaluations";

export const metadata: Metadata = { title: "Symphonies · Orchestra" };

export default function SymphoniesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Symphonies</h1>
        <p className="text-sm text-muted-foreground">
          Example strategies and the allocation each one targets today.
        </p>
      </div>
      {/* Reads the database at request time; stream it in. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SymphonyEvaluations />
      </Suspense>
    </main>
  );
}

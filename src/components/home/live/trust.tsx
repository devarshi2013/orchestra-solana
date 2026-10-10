"use client";

import { ArrowRight, FileSearch, ListChecks, Wallet } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";

import { GradientCard } from "../effects";
import { LiveStamp, useHomeMarket } from "./home-market";

/**
 * Why the numbers can be trusted: the live count of verified stocks with a
 * link to the public registry (every mint, issuer and when it was last
 * verified), and short notes on custody and sourcing.
 */
export function Trust() {
  const { overview, failed } = useHomeMarket();
  const verified = overview ? new Date(overview.verifiedAt) : null;
  return (
    <section aria-labelledby="trust-heading" className="px-4 pb-24 sm:px-6 sm:pb-32">
      <Reveal className="mx-auto max-w-6xl space-y-6">
        <h2 id="trust-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Checked, sourced, <em className="accent-sweep text-gradient-silver pr-[0.08em]">yours</em>
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <GradientCard innerClassName="flex h-full flex-col gap-3 p-6">
            <ListChecks className="size-5 text-[var(--label-blue)]" aria-hidden />
            <div className="font-mono text-4xl font-medium tabular-nums">
              {failed ? (
                <span className="text-sm text-muted-foreground">Data unavailable</span>
              ) : overview ? (
                overview.totals.stocks
              ) : (
                <Skeleton className="h-10 w-20" />
              )}
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Verified stocks</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Every token comes from its issuer&apos;s official list and is checked on Jupiter
              {verified &&
                `; last verified ${verified.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              .
            </p>
            <Link
              href="/registry"
              className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-[var(--label-blue)] outline-none hover:underline focus-visible:underline"
            >
              See the full registry <ArrowRight className="size-4" aria-hidden />
            </Link>
            <LiveStamp at={overview ? Date.parse(overview.asOf) : null} />
          </GradientCard>
          <GradientCard innerClassName="flex h-full flex-col gap-3 p-6">
            <Wallet className="size-5 text-[var(--label-blue)]" aria-hidden />
            <h3 className="text-lg font-semibold tracking-tight">Non-custodial</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Quill never holds your funds or keys. Every trade is a transaction you review and sign
              in your own wallet.
            </p>
          </GradientCard>
          <GradientCard innerClassName="flex h-full flex-col gap-3 p-6">
            <FileSearch className="size-5 text-[var(--label-blue)]" aria-hidden />
            <h3 className="text-lg font-semibold tracking-tight">Every number is sourced</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Prices, volume and quotes come live from Jupiter, history from GeckoTerminal, and
              counts from the registry. If a figure can&apos;t be read, you see &quot;Data
              unavailable&quot;, never a guess.
            </p>
          </GradientCard>
        </div>
      </Reveal>
    </section>
  );
}

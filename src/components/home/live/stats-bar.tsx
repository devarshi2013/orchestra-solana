"use client";

import { Reveal } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactUsd } from "@/lib/market/series";

import { LiveStamp, useHomeMarket } from "./home-market";

/**
 * Real numbers only: companies, sectors and issuers counted from the verified
 * registry, and the combined 24h volume Jupiter reports for the listed stock
 * tokens (left out when Jupiter reports none). No user counts, nothing invented.
 */
export function StatsBar() {
  const { overview, failed } = useHomeMarket();
  const t = overview?.totals;
  const stats: { label: string; value: string | null; note?: string }[] = [
    { label: "Verified stocks", value: t ? String(t.stocks) : null },
    { label: "Sectors covered", value: t ? String(t.sectors) : null },
    { label: "Issuers", value: t ? String(t.issuers) : null },
  ];
  if (!t || t.volume24h !== null) {
    stats.push({
      label: "24h volume",
      value: t ? formatCompactUsd(t.volume24h) : null,
      note: t ? `across ${t.volumeTokens} listed stock tokens` : undefined,
    });
  }

  return (
    <section aria-label="Quill in numbers" className="px-4 section-y sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card px-5 py-5">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-1.5 font-mono text-2xl font-medium tabular-nums sm:text-3xl">
                {failed ? (
                  <span className="text-sm text-muted-foreground">Data unavailable</span>
                ) : (
                  (s.value ?? <Skeleton className="h-8 w-20" />)
                )}
              </dd>
              {s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}
            </div>
          ))}
        </dl>
        <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Counts come from Quill&apos;s verified registry; volume is Jupiter&apos;s 24h figure.
          </span>
          <LiveStamp at={overview ? Date.parse(overview.asOf) : null} />
        </p>
      </Reveal>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/motion";
import { getJson } from "@/hooks/use-markets";
import type { InvestorExtras, NetworkStats } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

import { CurrencyTile, FractionSlider, GapGauge, HoursDial, NetworkTile } from "./tiles";

const NETWORK_REFRESH_MS = 30_000;

/**
 * The bento of live investor tiles. Desktop: the dial is the large tile with
 * two tiles stacked beside it; tablets: two columns; phones: one column with
 * the dial first. The gap gauge and the currency converter need a fundamentals
 * source, so they are left out (not faked) when it has no data.
 */
export function InvestorBento() {
  const root = useRef<HTMLUListElement>(null);
  const [network, setNetwork] = useState<{ stats: NetworkStats | null; failed: boolean }>({
    stats: null,
    failed: false,
  });
  const [extras, setExtras] = useState<InvestorExtras | null>(null);

  // Throughput: on mount, then every 30 s while the section is on screen and the tab is visible.
  useEffect(() => {
    const abort = new AbortController();
    let inView = true;
    const load = () =>
      getJson<NetworkStats>("/api/network", abort.signal)
        .then((stats) => setNetwork({ stats, failed: false }))
        .catch(() => {
          if (!abort.signal.aborted) setNetwork((n) => ({ ...n, failed: true }));
        });
    void load();
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
    });
    if (root.current) observer.observe(root.current);
    const timer = setInterval(() => {
      if (inView && !document.hidden) void load();
    }, NETWORK_REFRESH_MS);
    return () => {
      abort.abort();
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    getJson<InvestorExtras>("/api/markets/extras", abort.signal)
      .then(setExtras)
      .catch((e: unknown) => {
        if (!abort.signal.aborted) console.error("[home] investor extras failed", e);
      });
    return () => abort.abort();
  }, []);

  const gaps = extras?.gaps?.length ? extras.gaps : null;
  const audUsd = extras?.audUsd ?? null;
  const both = Boolean(gaps && audUsd);

  return (
    <ul ref={root} className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <Reveal as="li" className="sm:col-span-2 lg:col-span-4 lg:row-span-2">
        <HoursDial />
      </Reveal>
      <Reveal as="li" delay={0.08} className="lg:col-span-2">
        <FractionSlider />
      </Reveal>
      <Reveal as="li" delay={0.16} className="lg:col-span-2">
        <NetworkTile stats={network.stats} failed={network.failed} />
      </Reveal>
      {gaps && extras && (
        <Reveal
          as="li"
          delay={0.24}
          className={cn(both ? "lg:col-span-4" : "sm:col-span-2 lg:col-span-6")}
        >
          <GapGauge gaps={gaps} asOf={extras.asOf} />
        </Reveal>
      )}
      {audUsd && extras && (
        <Reveal
          as="li"
          delay={0.32}
          className={cn(both ? "lg:col-span-2" : "sm:col-span-2 lg:col-span-6")}
        >
          <CurrencyTile audUsd={audUsd} asOf={extras.asOf} />
        </Reveal>
      )}
    </ul>
  );
}

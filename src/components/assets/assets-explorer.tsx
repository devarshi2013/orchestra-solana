"use client";

import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetRegistry } from "@/hooks/use-asset-registry";
import { assetsApi, type LiquidityCheck } from "@/lib/api-client";
import { MAX_TEST_QUOTE_IMPACT_PCT, TEST_QUOTE_USD } from "@/lib/assets/config";
import { formatChange, formatPrice } from "@/lib/assets/format";
import { ISSUER_NAMES } from "@/lib/assets/registry";
import { cn } from "@/lib/utils";

import { AssetAvatar } from "./asset-avatar";

type Tab = "stock" | "crypto";
type Prices = Record<string, { usdPrice: number; priceChange24h: number | null }>;

/** /assets: the verified registry, with live prices and a liquidity test quote per asset. */
export function AssetsExplorer() {
  const { registry, error } = useAssetRegistry();
  const [tab, setTab] = useState<Tab>("stock");
  const [prices, setPrices] = useState<Partial<Record<Tab, Prices>>>({});
  const [checks, setChecks] = useState<Record<string, LiquidityCheck | "error">>({});

  const assets = registry ? (tab === "stock" ? registry.stocks : registry.crypto) : [];

  // Live prices for the open tab (refreshed every minute).
  useEffect(() => {
    if (!registry) return;
    const controller = new AbortController();
    const load = () =>
      assetsApi
        .prices(tab, controller.signal)
        .then((p) => setPrices((all) => ({ ...all, [tab]: p })))
        .catch(() => {});
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [registry, tab]);

  // Test quotes, one at a time (the server caches them and paces Jupiter).
  useEffect(() => {
    if (!registry) return;
    const controller = new AbortController();
    void (async () => {
      for (const asset of tab === "stock" ? registry.stocks : registry.crypto) {
        if (asset.cash || controller.signal.aborted) continue;
        let result: LiquidityCheck | "error" = "error";
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            result = await assetsApi.liquidity(asset.mint, controller.signal);
            break;
          } catch (e) {
            if (controller.signal.aborted) return;
            // Rate limited: Jupiter's free plan is shared; wait and retry once.
            if ((e as { status?: number }).status === 429)
              await new Promise((r) => setTimeout(r, 3000));
            else break;
          }
        }
        setChecks((all) => (all[asset.mint] ? all : { ...all, [asset.mint]: result }));
      }
    })();
    return () => controller.abort();
  }, [registry, tab]);

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Couldn&apos;t load assets</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!registry) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b" role="tablist" aria-label="Asset type">
        {(["stock", "crypto"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "stock"
              ? `Stocks (${registry.stocks.length})`
              : `Crypto (${registry.crypto.length})`}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Tokenized stocks have eligibility rules</AlertTitle>
          <AlertDescription>
            Issued by Ondo Global Markets and xStocks (Backed), not by Orchestra. Neither is
            available to US persons; xStocks excludes UK clients; several regions limit them to
            professional or qualified investors. Neither issuer addresses Australia; treat it as
            unconfirmed. They trade on the issuers&apos; 24/5 schedules, so weekend prices can gap.
            Issuers can pause a token, which blocks swaps.
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Asset</th>
              <th className="px-3 py-2 font-medium">
                {tab === "stock" ? "Sector · Issuer" : "Category"}
              </th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">24h</th>
              <th className="px-3 py-2 font-medium">
                Liquidity{" "}
                <span className="font-normal">(${TEST_QUOTE_USD.toLocaleString()} test quote)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const price = prices[tab]?.[asset.mint];
              return (
                <tr key={asset.mint} className="border-t">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AssetAvatar asset={asset} className="size-7" />
                      <div className="min-w-0">
                        <div className="font-medium">
                          {asset.ticker}
                          {asset.symbol !== asset.ticker && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              {asset.symbol}
                            </span>
                          )}
                        </div>
                        <div className="max-w-56 truncate text-xs text-muted-foreground">
                          {asset.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {asset.category}
                    {asset.issuer && (
                      <div>
                        {ISSUER_NAMES[asset.issuer]} · {asset.hours}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {price ? formatPrice(price.usdPrice) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      (price?.priceChange24h ?? 0) > 0 && "text-emerald-700 dark:text-emerald-400",
                      (price?.priceChange24h ?? 0) < 0 && "text-destructive",
                    )}
                  >
                    {formatChange(price?.priceChange24h)}
                  </td>
                  <td className="px-3 py-2">
                    {asset.cash ? (
                      <Badge variant="outline">Cash</Badge>
                    ) : (
                      <LiquidityCell check={checks[asset.mint]} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Registry verified against Jupiter {new Date(registry.builtAt).toLocaleString()}. Prices from
        Jupiter; a test quote is flagged above {MAX_TEST_QUOTE_IMPACT_PCT}% price impact.
      </p>
    </div>
  );
}

function LiquidityCell({ check }: { check: LiquidityCheck | "error" | undefined }) {
  if (!check) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Checking
      </span>
    );
  }
  if (check === "error") return <span className="text-xs text-muted-foreground">Unavailable</span>;
  if (check.status === "no_route") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <TriangleAlert className="size-3.5" /> No route right now
      </span>
    );
  }
  return check.status === "thin" ? (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
      <TriangleAlert className="size-3.5" /> Thin: {check.impactPct.toFixed(2)}% impact
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
      <CircleCheck className="size-3.5" />{" "}
      {check.impactPct < 0.01 ? "<0.01" : check.impactPct.toFixed(2)}% impact
    </span>
  );
}

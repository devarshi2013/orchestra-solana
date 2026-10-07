"use client";

import { TriangleAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAssetRegistry } from "@/hooks/use-asset-registry";
import { looksThin } from "@/lib/assets/format";
import { ISSUER_NAMES, type Asset } from "@/lib/assets/registry";
import { cn } from "@/lib/utils";

import { AssetAvatar } from "./asset-avatar";

type Filter = "all" | "stock" | "crypto";

/**
 * Picks an asset from Orchestra's verified registry: the only way a mint
 * enters a symphony. There is no free-text mint entry.
 */
export function AssetPickerDialog({
  label,
  trigger,
  onSelect,
}: {
  label: string;
  trigger: ReactNode;
  onSelect: (asset: Asset) => void;
}) {
  const { registry, error } = useAssetRegistry();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const results = useMemo(() => {
    if (!registry) return [];
    const q = query.trim().toLowerCase();
    return [...registry.crypto, ...registry.stocks].filter(
      (a) =>
        (filter === "all" || a.kind === filter) &&
        (!q || [a.ticker, a.symbol, a.name].some((text) => text.toLowerCase().includes(q))),
    );
  }, [registry, query, filter]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Only assets in Orchestra&apos;s registry: verified on Jupiter and liquid enough to
            trade.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search SOL, NVDA, Apple…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-1" role="tablist" aria-label="Asset type">
          {(["all", "crypto", "stock"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2 py-1 text-xs",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f === "all" ? "All" : f === "crypto" ? "Crypto" : "Stocks"}
            </button>
          ))}
        </div>
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {error && <li className="px-2 py-3 text-sm text-destructive">{error}</li>}
          {!registry && !error && (
            <li className="px-2 py-3 text-sm text-muted-foreground">Loading the registry…</li>
          )}
          {registry && results.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted-foreground">Nothing matches.</li>
          )}
          {results.map((asset) => (
            <li key={asset.mint}>
              <button
                type="button"
                onClick={() => {
                  onSelect(asset);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
              >
                <AssetAvatar asset={asset} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    {asset.symbol}
                    {asset.kind === "stock" && asset.symbol !== asset.ticker && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {asset.ticker}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {asset.name} · {asset.category}
                    {asset.issuer && ` · ${ISSUER_NAMES[asset.issuer]} · ${asset.hours}`}
                  </span>
                </span>
                {asset.cash ? (
                  <Badge variant="outline">Cash</Badge>
                ) : looksThin(asset) ? (
                  <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-400">
                    <TriangleAlert className="size-3" /> Thin
                  </Badge>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

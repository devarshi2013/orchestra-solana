"use client";

import { ChevronDown, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchTokens } from "@/lib/api-client";
import { DEFAULT_TOKENS, isLowLiquidity, rankTokens, type TokenInfo } from "@/lib/tokens";

import { TokenAvatar } from "./token-avatar";

type Results = { query: string; tokens: TokenInfo[]; error?: string };

/**
 * Token search dialog backed by /api/tokens/search. Verified tokens are listed
 * first; flagged, unverified and low-liquidity tokens carry a warning.
 * Pass `trigger` to open it from your own button instead of the token chip.
 */
export function TokenSelectDialog({
  token,
  onSelect,
  disabled,
  label,
  trigger,
}: {
  token?: TokenInfo;
  onSelect: (token: TokenInfo) => void;
  disabled?: boolean;
  label: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchTokens(trimmed, controller.signal)
        .then((tokens) => setResults({ query: trimmed, tokens }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setResults({ query: trimmed, tokens: [], error: (error as Error).message });
          }
        });
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed]);

  const current = trimmed && results?.query === trimmed ? results : null;
  const tokens = trimmed ? rankTokens(current?.tokens ?? [], trimmed) : DEFAULT_TOKENS;

  function select(next: TokenInfo) {
    onSelect(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" disabled={disabled} aria-label={label} className="h-10 gap-2">
            {token && <TokenAvatar token={token} className="size-5" />}
            <span className="font-medium">{token?.symbol ?? "Choose token"}</span>
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>Search by name, symbol or mint address.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="SOL, Jupiter, EPjF…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {trimmed && !current && (
            <li className="px-2 py-3 text-sm text-muted-foreground">Searching…</li>
          )}
          {current?.error && (
            <li className="px-2 py-3 text-sm text-destructive">{current.error}</li>
          )}
          {current && !current.error && tokens.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted-foreground">No tokens found.</li>
          )}
          {tokens.map((t) => (
            <li key={t.mint}>
              <button
                type="button"
                onClick={() => select(t)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
              >
                <TokenAvatar token={t} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    {t.symbol}
                    {t.isVerified && (
                      <ShieldCheck className="size-3.5 text-emerald-600" aria-label="Verified" />
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{t.name}</span>
                </span>
                {t.isSus ? (
                  <Badge variant="destructive" className="gap-1">
                    <ShieldAlert className="size-3" /> Flagged
                  </Badge>
                ) : isLowLiquidity(t) ? (
                  <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-400">
                    <TriangleAlert className="size-3" /> Low liquidity
                  </Badge>
                ) : (
                  !t.isVerified && <Badge variant="outline">Unverified</Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

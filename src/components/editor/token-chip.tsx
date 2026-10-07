"use client";

import { ShieldAlert, TriangleAlert } from "lucide-react";

import { TokenAvatar } from "@/components/swap/token-avatar";
import { TokenSelectDialog } from "@/components/swap/token-select-dialog";
import { Button } from "@/components/ui/button";
import { isLowLiquidity, type TokenInfo } from "@/lib/tokens";

import { useEditor, useSymbolOf } from "./editor-context";

/** A token button: shows logo and symbol, opens the token picker to change it. */
export function TokenChip({
  mint,
  onChange,
  label,
}: {
  mint: string;
  onChange: (token: TokenInfo) => void;
  label: string;
}) {
  const { tokenOf, rememberToken } = useEditor();
  const symbolOf = useSymbolOf();
  const token = tokenOf(mint);
  return (
    <span className="inline-flex items-center gap-1">
      <TokenSelectDialog
        label={label}
        onSelect={(next) => {
          rememberToken(next);
          onChange(next);
        }}
        trigger={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            aria-label={`${label}: ${symbolOf(mint)}`}
          >
            {token ? (
              <TokenAvatar token={token} className="size-4" />
            ) : (
              <span className="size-4 rounded-full bg-muted" aria-hidden />
            )}
            {symbolOf(mint)}
          </Button>
        }
      />
      <TokenWarning token={token} />
    </span>
  );
}

export function TokenWarning({ token }: { token: TokenInfo | undefined }) {
  if (!token) return null;
  if (token.isSus) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-destructive">
        <ShieldAlert className="size-3.5" /> Flagged
      </span>
    );
  }
  if (isLowLiquidity(token)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-amber-700 dark:text-amber-400">
        <TriangleAlert className="size-3.5" /> Low liquidity
      </span>
    );
  }
  return null;
}

import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SwapState } from "@/hooks/use-swap";
import { formatBaseUnits } from "@/lib/amount";
import { solscanTxUrl } from "@/lib/solana";
import type { SwapErrorKind } from "@/lib/swap/errors";
import type { TokenInfo } from "@/lib/tokens";

function SolscanLink({ signature }: { signature: string }) {
  return (
    <a
      href={solscanTxUrl(signature, "mainnet-beta")}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
    >
      View on Solscan <ExternalLink className="size-3.5" />
    </a>
  );
}

/** Failures where simply re-quoting and re-signing can succeed. */
const RETRYABLE = new Set<SwapErrorKind>([
  "rejected",
  "expired",
  "slippage",
  "rate_limited",
  "network",
  "unknown",
]);

const PROGRESS_COPY: Partial<Record<SwapState["phase"], string>> = {
  quoting: "Getting a fresh quote…",
  requoting: "Quote expired — fetching a new one…",
  signing: "Approve the transaction in your wallet…",
  executing: "Sending and confirming…",
};

export function SwapStatus({
  state,
  inputToken,
  outputToken,
  onDismiss,
  onRetry,
}: {
  state: SwapState;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const progress = PROGRESS_COPY[state.phase];
  if (progress) {
    const resign = state.phase === "signing" && state.attempt > 1;
    return (
      <Alert>
        <Loader2 className="animate-spin" />
        <AlertTitle>{progress}</AlertTitle>
        {resign && (
          <AlertDescription>
            The previous quote expired before it was sent, so this is a new transaction. Nothing was
            swapped yet.
          </AlertDescription>
        )}
      </Alert>
    );
  }

  if (state.phase === "success" && state.result) {
    const { result } = state;
    return (
      <Alert>
        <CheckCircle2 className="text-emerald-600" />
        <AlertTitle>Swap confirmed</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          {result.totalInputAmount && result.totalOutputAmount && (
            <span>
              Swapped {formatBaseUnits(result.totalInputAmount, inputToken.decimals)}{" "}
              {inputToken.symbol} for{" "}
              {formatBaseUnits(result.totalOutputAmount, outputToken.decimals)} {outputToken.symbol}
              .
            </span>
          )}
          {result.signature && <SolscanLink signature={result.signature} />}
          <Button variant="outline" size="sm" className="self-start" onClick={onDismiss}>
            New swap
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (state.phase === "error" && state.error) {
    const { error } = state;
    return (
      <Alert variant="destructive">
        <XCircle />
        <AlertTitle>{error.title}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{error.message}</span>
          {error.signature && <SolscanLink signature={error.signature} />}
          <div className="flex gap-2">
            {RETRYABLE.has(error.kind) && (
              <Button size="sm" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

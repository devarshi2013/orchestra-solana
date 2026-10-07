"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowDownUp } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { QUOTE_REFRESH_MS, useQuote } from "@/hooks/use-quote";
import { useSwap, type SwapPhase } from "@/hooks/use-swap";
import { formatBaseUnits, parseAmountToBaseUnits } from "@/lib/amount";
import { useSwapForm } from "@/stores/swap-form";

import { QuoteDetails } from "./quote-details";
import { SwapStatus } from "./swap-status";
import { TokenSelectDialog } from "./token-select-dialog";

const BUSY_LABELS: Partial<Record<SwapPhase, string>> = {
  quoting: "Preparing…",
  requoting: "Re-quoting…",
  signing: "Waiting for signature…",
  executing: "Swapping…",
};

export function SwapCard() {
  const { inputToken, outputToken, amount, setAmount, setInputToken, setOutputToken, flip } =
    useSwapForm();
  const { publicKey, connected } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const { state, swap, reset, inFlight } = useSwap();

  const baseUnits = parseAmountToBaseUnits(amount, inputToken.decimals);
  const amountInvalid = amount.trim() !== "" && baseUnits === null;
  const hasAmount = baseUnits !== null && baseUnits > 0n;

  const {
    quote,
    error: quoteError,
    loading: quoteLoading,
  } = useQuote({
    inputMint: inputToken.mint,
    outputMint: outputToken.mint,
    amount: baseUnits,
    taker: publicKey?.toBase58(),
    paused: inFlight || state.phase === "success",
  });

  // Editing the form after a finished swap starts over.
  const settled = state.phase === "success" || state.phase === "error";
  const edit =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      if (settled) reset();
      fn(v);
    };

  function startSwap() {
    if (!hasAmount) return;
    void swap({
      inputMint: inputToken.mint,
      outputMint: outputToken.mint,
      amount: baseUnits.toString(),
    });
  }

  const button = (() => {
    if (!connected)
      return { label: "Connect wallet", onClick: () => openWalletModal(true), disabled: false };
    if (inFlight) return { label: BUSY_LABELS[state.phase] ?? "Working…", disabled: true };
    if (amountInvalid) return { label: `Max ${inputToken.decimals} decimals`, disabled: true };
    if (!hasAmount) return { label: "Enter an amount", disabled: true };
    if (quoteLoading) return { label: "Fetching quote…", disabled: true };
    if (quoteError) return { label: quoteError.title, disabled: true };
    if (!quote) return { label: "No quote", disabled: true };
    return { label: "Swap", onClick: startSwap, disabled: false };
  })();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Swap</CardTitle>
        <CardDescription>
          Best price across Jupiter&apos;s routers. Your wallet signs; nothing is custodied.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="rounded-lg border p-3">
          <Label htmlFor="swap-amount" className="text-xs text-muted-foreground">
            You pay
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="swap-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={amount}
              disabled={inFlight}
              aria-invalid={amountInvalid}
              onChange={(e) => {
                const next = e.target.value.replace(",", ".");
                if (/^\d*\.?\d*$/.test(next)) edit(setAmount)(next);
              }}
              className="h-10 border-0 px-0 text-2xl shadow-none focus-visible:ring-0"
            />
            <TokenSelectDialog
              label="Select token to pay"
              token={inputToken}
              onSelect={edit(setInputToken)}
              disabled={inFlight}
            />
          </div>
        </div>

        <div className="-my-1 flex justify-center">
          <Button
            variant="outline"
            size="icon"
            aria-label="Flip tokens"
            disabled={inFlight}
            onClick={() => edit(flip)(undefined)}
          >
            <ArrowDownUp className="size-4" />
          </Button>
        </div>

        <div className="rounded-lg border p-3">
          <span className="text-xs text-muted-foreground">You receive</span>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-10 min-w-0 flex-1 items-center text-2xl" aria-live="polite">
              {hasAmount && quoteLoading ? (
                <Skeleton className="h-7 w-32" />
              ) : quote ? (
                <span className="truncate">
                  {formatBaseUnits(quote.outAmount, outputToken.decimals)}
                </span>
              ) : (
                <span className="text-muted-foreground">0.0</span>
              )}
            </div>
            <TokenSelectDialog
              label="Select token to receive"
              token={outputToken}
              onSelect={edit(setOutputToken)}
              disabled={inFlight}
            />
          </div>
        </div>

        {quote && hasAmount && !quoteLoading && (
          <>
            <Separator />
            <QuoteDetails quote={quote} inputToken={inputToken} outputToken={outputToken} />
            <p className="text-xs text-muted-foreground">
              Quote refreshes every {QUOTE_REFRESH_MS / 1000}s.
            </p>
          </>
        )}

        {quoteError && hasAmount && !quoteLoading && !settled && (
          <Alert variant="destructive">
            <AlertTitle>{quoteError.title}</AlertTitle>
            <AlertDescription>{quoteError.message}</AlertDescription>
          </Alert>
        )}

        <SwapStatus
          state={state}
          inputToken={inputToken}
          outputToken={outputToken}
          onDismiss={reset}
          onRetry={startSwap}
        />
      </CardContent>

      <CardFooter>
        <Button
          className="h-11 w-full text-base"
          disabled={button.disabled}
          onClick={button.onClick}
        >
          {button.label}
        </Button>
      </CardFooter>
    </Card>
  );
}

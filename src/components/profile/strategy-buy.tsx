"use client";

import { ExternalLink, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import { IconButton, SoftButton } from "@/components/assistant/controls";
import { CardReveal, Expand, RevealRow, RollText, SwapStatus } from "@/components/motion";
import { useWallet, useWalletModal } from "@/components/wallet";
import type { BuyStep } from "@/hooks/use-plan-buy";
import { useTrade, type TradeStep } from "@/hooks/use-trade";
import { solscanTxUrl } from "@/lib/solana";
import type { Strategy } from "@/lib/strategies/types";
import { describePriceImpact } from "@/lib/swap/quote";
import { toUnits } from "@/lib/units";

const STEP: Record<TradeStep, BuyStep | null> = {
  idle: null,
  signing: "signing",
  sending: "sending",
  done: "bought",
  failed: "failed",
};

/**
 * Buying a triggered strategy: its token and amount, a live quote, then the
 * wallet signs and our API lands the swap. The fill is recorded against the
 * strategy, then `onFilled` refreshes the profile.
 */
export function StrategyBuy({
  strategy,
  decimals,
  onClose,
  onFilled,
}: {
  strategy: Strategy;
  /** The token's decimals, from the stock universe. */
  decimals: number;
  onClose: () => void;
  onFilled: () => void;
}) {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [amountText, setAmountText] = useState(String(strategy.usdcAmount));
  const amount = Number(amountText) > 0 ? Number(amountText) : 0;
  const trade = useTrade({
    side: "buy",
    mint: strategy.mint,
    decimals,
    amount,
    strategyId: strategy.id,
    onRecorded: onFilled,
  });
  const q = trade.quote;
  const received = q ? toUnits(q.outAmount, decimals) : null;
  const working = trade.step === "signing" || trade.step === "sending";
  const status = STEP[trade.step];

  return (
    <CardReveal className="mt-2 rounded-[20px] bg-white text-[14px] tracking-[-0.01em] shadow-hairline">
      <div className="space-y-3 p-4">
        <RevealRow className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-semibold text-text-extra-high">
            Buy {strategy.symbol}
          </p>
          {status && <SwapStatus step={status} />}
          <IconButton
            onClick={onClose}
            aria-label="Close"
            className="-my-1 size-7 [&_svg]:size-3.5"
          >
            <X />
          </IconButton>
        </RevealRow>

        <RevealRow className="flex h-11 items-center rounded-[14px] bg-soft px-3.5 focus-within:bg-white focus-within:shadow-hairline">
          <input
            inputMode="decimal"
            value={amountText}
            disabled={working || trade.step === "done"}
            onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ""))}
            aria-label="USDC to spend"
            className="min-w-0 flex-1 bg-transparent font-medium text-text-extra-high tabular-nums outline-none"
          />
          <span className="text-[12.5px] font-medium text-ink-muted">USDC</span>
        </RevealRow>

        {amount > 0 && (
          <Expand className="grid grid-cols-2 gap-2 rounded-[14px] bg-soft px-3.5 py-2.5 text-[13px]">
            <span className="text-ink-muted">You receive</span>
            <span className="text-right font-medium text-text-extra-high tabular-nums">
              {trade.quoting ? (
                "…"
              ) : received !== null ? (
                <RollText
                  value={`≈ ${received.toLocaleString("en-US", { maximumFractionDigits: 6 })}`}
                />
              ) : (
                "—"
              )}
            </span>
            <span className="text-ink-muted">Price impact</span>
            <span className="text-right font-medium text-text-extra-high tabular-nums">
              {q ? <RollText value={describePriceImpact(q.priceImpact).text} /> : "—"}
            </span>
          </Expand>
        )}

        {(trade.error ?? trade.quoteError) && (
          <p role="alert" className="flex items-start gap-1.5 text-[12.5px] text-status-error-text">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{trade.error ?? trade.quoteError}</span>
          </p>
        )}

        {trade.step === "done" ? (
          trade.signature && (
            <RevealRow>
              <a
                href={solscanTxUrl(trade.signature, "mainnet-beta")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted hover:text-text-extra-high"
              >
                View on Solscan <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </RevealRow>
          )
        ) : connected ? (
          <SoftButton
            dark
            className="h-11 w-full"
            disabled={!q || working || !trade.canSign}
            onClick={() => void trade.execute()}
          >
            {working ? "Approve in your wallet…" : "Buy"}
          </SoftButton>
        ) : (
          <SoftButton dark className="h-11 w-full" onClick={() => setVisible(true)}>
            Connect wallet
          </SoftButton>
        )}
      </div>
    </CardReveal>
  );
}

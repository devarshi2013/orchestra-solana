"use client";

import { SoftButton } from "@/components/assistant/controls";
import { PnlToaster, showPnlToast } from "@/components/share/pnl-toast";
import { SharePnlButton } from "@/components/share/share-pnl-button";

const SAMPLE_WALLET = "3jupp7SHa9dKKnqEMHrhrzi6KXinwEjYNgqET4CgA21u";
const SAMPLE_SIGNATURE =
  "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";

/** Sample data only: this page 404s in production. */
export function SharePreview() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pt-32 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-title-md text-text-extra-high">Share preview</h1>
        <SharePnlButton wallet={SAMPLE_WALLET} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG. */}
      <img
        src="/dev/share-preview/card"
        alt="Sample P&L card"
        className="w-full rounded-[16px] shadow-hairline"
      />
      <div className="flex flex-wrap gap-2">
        <SoftButton
          onClick={() =>
            showPnlToast({
              symbol: "NVDAx",
              side: "buy",
              usdcAmount: 190,
              tokenAmount: 0.8213,
              price: 231.34,
              signature: SAMPLE_SIGNATURE,
            })
          }
        >
          Buy toast
        </SoftButton>
        <SoftButton
          onClick={() =>
            showPnlToast({
              symbol: "MU",
              side: "sell",
              usdcAmount: 412.5,
              tokenAmount: 0.4,
              price: 1031.25,
              pnlPct: 12.4,
              signature: SAMPLE_SIGNATURE,
            })
          }
        >
          Sell toast
        </SoftButton>
      </div>
      <PnlToaster />
    </main>
  );
}

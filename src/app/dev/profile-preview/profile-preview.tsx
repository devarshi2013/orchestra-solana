"use client";

import { ProfileView, type ProfileActions } from "@/components/profile/profile-view";
import { SharePnlButton } from "@/components/share/share-pnl-button";
import type { LivePrices } from "@/hooks/use-live-prices";
import type { HistoryState } from "@/hooks/use-profile";
import type { ProfileResponse } from "@/lib/strategies/types";

const NVDAX = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh";
const MU = "MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1";
const SPYX = "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W";
const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

/** Sample data for checking the signed-in profile's layout (dev only). */
const PROFILE: ProfileResponse = {
  wallet: WALLET,
  webhookUrl: null,
  usdcBalance: 412.37,
  positions: [
    {
      mint: NVDAX,
      symbol: "NVDAx",
      ticker: "NVDA",
      name: "NVIDIA",
      icon: null,
      tokenAmount: 1.2481,
      recordedAmount: 1.2481,
      avgCost: 214.5,
      costBasis: 267.72,
    },
    {
      mint: MU,
      symbol: "MU",
      ticker: "MU",
      name: "Micron Technology",
      icon: null,
      tokenAmount: 0.0912,
      recordedAmount: 0.0912,
      avgCost: 279.1,
      costBasis: 25.45,
    },
    {
      mint: SPYX,
      symbol: "SPYx",
      ticker: "SPY",
      name: "SP500",
      icon: null,
      tokenAmount: 0.05,
      recordedAmount: 0,
      avgCost: null,
      costBasis: null,
    },
  ],
  strategies: [
    {
      id: "6f1c8a52-0000-4000-8000-000000000001",
      wallet: WALLET,
      mint: NVDAX,
      symbol: "NVDAx",
      ticker: "NVDA",
      name: "NVIDIA",
      usdcAmount: 190,
      condition: { type: "price_below", price: 225 },
      repeat: false,
      status: "triggered",
      createdAt: ago(60 * 26),
      triggeredAt: ago(4),
      triggerValue: 224.81,
      lastFillSignature: null,
    },
    {
      id: "6f1c8a52-0000-4000-8000-000000000002",
      wallet: WALLET,
      mint: MU,
      symbol: "MU",
      ticker: "MU",
      name: "Micron Technology",
      usdcAmount: 50,
      condition: { type: "change_below", pct: -5 },
      repeat: true,
      status: "watching",
      createdAt: ago(60 * 50),
      triggeredAt: null,
      triggerValue: null,
      lastFillSignature: null,
    },
    {
      id: "6f1c8a52-0000-4000-8000-000000000003",
      wallet: WALLET,
      mint: SPYX,
      symbol: "SPYx",
      ticker: "SPY",
      name: "SP500",
      usdcAmount: 25,
      condition: { type: "every", days: 7 },
      repeat: true,
      status: "filled",
      createdAt: ago(60 * 24 * 9),
      triggeredAt: ago(60 * 24 * 2),
      triggerValue: null,
      lastFillSignature: "5h3Vk",
    },
  ],
  notifications: [
    {
      id: "n1",
      strategyId: "6f1c8a52-0000-4000-8000-000000000001",
      kind: "triggered",
      title: "NVDAx is below $225.00",
      body: "Buy $190 of NVDAx is ready to approve.",
      createdAt: ago(4),
      readAt: null,
    },
    {
      id: "n2",
      strategyId: "6f1c8a52-0000-4000-8000-000000000003",
      kind: "filled",
      title: "Bought SPYx",
      body: "$25.00 → 0.0372 SPYx",
      createdAt: ago(60 * 24 * 2),
      readAt: ago(60 * 24),
    },
  ],
  fills: [
    {
      signature:
        "4kSeq9xJ1nW8eVp3QzK5tYhR2mL7cB6dF1gH8jN3pX9sT4uV5wY6zA7bC8dE9fG1hJ2kL3mN4pQ5rS6tU7vW8x",
      wallet: WALLET,
      strategyId: null,
      mint: NVDAX,
      symbol: "NVDAx",
      side: "buy",
      usdcAmount: 267.72,
      tokenAmount: 1.2481,
      price: 214.5,
      blockTime: ago(60 * 24 * 5),
    },
    {
      signature:
        "2mN4pQ5rS6tU7vW8xY9zA1bC2dE3fG4hJ5kL6mN7pQ8rS9tU1vW2xY3zA4bC5dE6fG7hJ8kL9mN1pQ2rS3tU4v",
      wallet: WALLET,
      strategyId: null,
      mint: MU,
      symbol: "MU",
      side: "buy",
      usdcAmount: 25.45,
      tokenAmount: 0.0912,
      price: 279.1,
      blockTime: ago(60 * 24 * 3),
    },
  ],
};

// Sample trades spread over the last weeks (deterministic, so screenshots are stable).
const MORE_FILLS: ProfileResponse["fills"] = Array.from({ length: 14 }, (_, i) => {
  const sell = i % 5 === 4;
  const [mint, symbol, price] =
    i % 3 === 0
      ? [NVDAX, "NVDAx", 205 + i * 1.7]
      : i % 3 === 1
        ? [MU, "MU", 262 + i]
        : [SPYX, "SPYx", 655 + i];
  const usdcAmount = 20 + ((i * 37) % 60);
  return {
    signature: `sample${String(i).padStart(3, "0")}`.padEnd(88, "x"),
    wallet: WALLET,
    strategyId: null,
    mint,
    symbol,
    side: sell ? "sell" : "buy",
    usdcAmount,
    tokenAmount: usdcAmount / price,
    price,
    blockTime: ago(60 * 24 * (8 + i * 4) + i * 90),
  };
});
PROFILE.fills.push(...MORE_FILLS);
// Newest first, as the API returns them.
PROFILE.fills.sort((a, b) => b.blockTime.localeCompare(a.blockTime));

// 30 days: 8 backfilled, then snapshots, today live.
const HISTORY: HistoryState = {
  error: null,
  points: Array.from({ length: 30 }, (_, i) => {
    const wave = Math.sin(i / 3.2) * 9 + Math.cos(i / 1.7) * 4;
    return {
      time: Math.floor((now - (29 - i) * 86_400_000) / 86_400_000) * 86_400,
      value: 610 + i * 3.1 + wave,
      pnl: -4 + i * 0.85 + wave * 0.6,
      source: i < 8 ? "backfill" : i === 29 ? "live" : "snapshot",
    };
  }),
};

const PRICES: LivePrices = {
  prices: {
    [NVDAX]: { price: 231.08, change24h: 0.3 },
    [MU]: { price: 274.1, change24h: -1.2 },
    [SPYX]: { price: 671.4, change24h: 0.4 },
  },
  asOf: new Date(now).toISOString(),
  stale: false,
};

const noop = async () => {};
const ACTIONS: ProfileActions = {
  reload: () => {},
  setStatus: noop,
  remove: noop,
  setWebhook: noop,
  markRead: noop,
};

export function ProfilePreview() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-6 pt-28 pb-24">
      <p className="mb-4 text-[12px] font-medium tracking-wide text-status-warning-text uppercase">
        Sample data
      </p>
      <ProfileView
        profile={PROFILE}
        prices={PRICES}
        error={null}
        actions={ACTIONS}
        history={HISTORY}
        share={<SharePnlButton wallet={WALLET} />}
      />
    </main>
  );
}

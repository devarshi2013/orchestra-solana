import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearCache } from "@/server/cache";

import { getComparison, sparklinePoints } from "./compare";

const NVDAON = "gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo";
const NVDAX = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh";
const MSFTON = "FRmH6iRkMr33DLG6zVLR7EM4LojBFAuq6NtFzG6ondo";
const MSFTX = "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX";

vi.mock("server-only", () => ({}));
vi.mock("@/server/jupiter/client", () => ({
  jupiterFetch: vi.fn(async (path: string) =>
    Response.json(
      path === "price/v3"
        ? {
            [NVDAON]: { usdPrice: 182.4, priceChange24h: 1.2 },
            [NVDAX]: { usdPrice: 182.9, priceChange24h: 1.1 },
            [MSFTON]: { usdPrice: 704.3, priceChange24h: 35 },
            [MSFTX]: { usdPrice: 535.1, priceChange24h: 2.4 },
          }
        : [],
    ),
  ),
}));
vi.mock("./history", () => ({
  getHistory: vi.fn(async () => ({
    series: {
      [NVDAX]: [
        { time: 1, open: 1, high: 1, low: 1, close: 180 },
        { time: 2, open: 1, high: 1, low: 1, close: 182 },
      ],
    },
    pending: [MSFTX],
    failed: {},
  })),
}));

describe("getComparison", () => {
  beforeEach(() => clearCache());

  it("prices each ticker from its most liquid token, from the registry only", async () => {
    const result = await getComparison(["NVDA", "NOPE"]);
    expect(result.unknown).toEqual(["NOPE"]);
    expect(result.rows.NVDA).toMatchObject({
      symbol: "NVDAon",
      price: 182.4,
      change24h: 1.2,
      priceNote: null,
      sparkline: [
        { time: 1, value: 180 },
        { time: 2, value: 182 },
      ],
    });
  });

  it("shows no price when the issuers' tokens disagree, and reports loading sparklines", async () => {
    const result = await getComparison(["MSFT"]);
    expect(result.rows.MSFT).toMatchObject({ price: null, change24h: null, sparkline: null });
    expect(result.rows.MSFT!.priceNote).toMatch(/differ by 32%/);
    expect(result.pending).toEqual(["MSFT"]);
  });

  it("drops bad prints from sparklines, and distrusts a history full of them", () => {
    const c = (time: number, close: number) => ({
      time,
      open: close,
      high: close,
      low: close,
      close,
    });
    const good = Array.from({ length: 20 }, (_, i) => c(i, 200 + i));
    expect(sparklinePoints([...good, c(20, 2_253_521)])).toHaveLength(20);
    const noisy = good.map((p, i) => (i % 3 === 0 ? c(i, 690) : p));
    expect(sparklinePoints(noisy)).toBeNull();
  });
});

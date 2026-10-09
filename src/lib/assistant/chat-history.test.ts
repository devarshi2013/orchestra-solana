import { describe, expect, it } from "vitest";

import type { ChatTurn } from "@/hooks/use-agent-chat";

import {
  groupChats,
  loadChats,
  reopened,
  saveChats,
  storageKey,
  titleFrom,
  type StoredChat,
} from "./chat-history";

/** An in-memory Storage that throws once more than `quota` characters are stored. */
function fakeStorage(quota = Number.POSITIVE_INFINITY): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (v.length > quota) throw new DOMException("full", "QuotaExceededError");
      data.set(k, v);
    },
  };
}

const chat = (id: string, updatedAt: number, o: Partial<StoredChat> = {}): StoredChat => ({
  id,
  title: id,
  renamed: false,
  createdAt: updatedAt,
  updatedAt,
  turns: [{ role: "user", text: id }],
  history: [{ role: "user", content: "x".repeat(200) }],
  ...o,
});

describe("titleFrom", () => {
  it("uses the first message, cut at a word", () => {
    expect(titleFrom("  Top   tech stocks?  ")).toBe("Top tech stocks?");
    expect(titleFrom("I have 200 USDC. Suggest 3 large US tech stocks ranked by market cap")).toBe(
      "I have 200 USDC. Suggest 3 large US tech stocks…",
    );
    expect(titleFrom("")).toBe("New chat");
  });
});

describe("groupChats", () => {
  it("groups by Today / Yesterday / Previous 7 days / Older, newest first", () => {
    const now = new Date(2026, 9, 10, 15, 0);
    const at = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
    const groups = groupChats(
      [
        chat("old", at(1)),
        chat("today-early", at(10, 1)),
        chat("yday", at(9)),
        chat("week", at(5)),
        chat("today", at(10, 14)),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.chats.map((c) => c.id)])).toEqual([
      ["Today", ["today", "today-early"]],
      ["Yesterday", ["yday"]],
      ["Previous 7 days", ["week"]],
      ["Older", ["old"]],
    ]);
    expect(groupChats([], now)).toEqual([]);
  });
});

describe("saveChats / loadChats", () => {
  it("round-trips per wallet, newest first", () => {
    const storage = fakeStorage();
    saveChats(storage, "walletA", [chat("a1", 1), chat("a2", 2)]);
    saveChats(storage, "walletB", [chat("b1", 5)]);
    expect(loadChats(storage, "walletA").map((c) => c.id)).toEqual(["a2", "a1"]);
    expect(loadChats(storage, "walletB").map((c) => c.id)).toEqual(["b1"]);
    expect(loadChats(storage, "walletC")).toEqual([]);
  });

  it("frees space when full: old chats' model history first, then the oldest chats", () => {
    const chats = [chat("new", 3), chat("mid", 2), chat("old", 1)];
    const roomForAllButHistory = JSON.stringify(
      chats.map((c, i) => (i ? { ...c, history: null } : c)),
    ).length;
    const kept = saveChats(fakeStorage(roomForAllButHistory), "w", chats);
    expect(kept.map((c) => [c.id, c.history === null])).toEqual([
      ["new", false],
      ["mid", true],
      ["old", true],
    ]);
    const tight = saveChats(fakeStorage(JSON.stringify([chats[0]]).length), "w", chats);
    expect(tight.map((c) => c.id)).toEqual(["new"]);
  });

  it("never throws on broken or blocked storage", () => {
    const storage = fakeStorage();
    storage.setItem(storageKey("w"), "{not json");
    expect(loadChats(storage, "w")).toEqual([]);
    expect(loadChats(undefined, "w")).toEqual([]);
    expect(saveChats(fakeStorage(0), "w", [chat("a", 1)]).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("reopened", () => {
  it("marks cut-off replies and swaps, keeping finished purchases and their signatures", () => {
    const turns: ChatTurn[] = [
      { role: "user", text: "buy" },
      {
        role: "assistant",
        text: "Plan",
        tools: [],
        progress: "",
        done: true,
        buy: {
          stopped: null,
          items: [
            {
              symbol: "NVDAx",
              name: "NVIDIA",
              mint: "m1",
              decimals: 8,
              usdcAmount: 20,
              step: "bought",
              signature: "sig1",
              outAmount: "1",
              error: null,
            },
            {
              symbol: "AAPLx",
              name: "Apple",
              mint: "m2",
              decimals: 8,
              usdcAmount: 20,
              step: "sending",
              signature: null,
              outAmount: null,
              error: null,
            },
          ],
        },
      },
      { role: "assistant", text: "half", tools: [], progress: "Thinking", done: false },
    ];
    const [, planTurn, cut] = reopened(turns) as [
      ChatTurn,
      Extract<ChatTurn, { role: "assistant" }>,
      Extract<ChatTurn, { role: "assistant" }>,
    ];
    expect(planTurn.buy!.items[0]).toMatchObject({ step: "bought", signature: "sig1" });
    expect(planTurn.buy!.items[1]).toMatchObject({
      step: "failed",
      error: expect.stringMatching(/Check your wallet/),
    });
    expect(cut).toMatchObject({ done: true, progress: "", error: "This reply was interrupted." });
  });
});

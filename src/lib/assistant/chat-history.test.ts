import { describe, expect, it } from "vitest";

import type { ChatTurn } from "@/hooks/use-agent-chat";

import {
  applyAiTitle,
  capChats,
  chatIdFromPath,
  cleanAiTitle,
  clearChats,
  deleteChat,
  GUEST,
  groupChats,
  hasPurchase,
  loadChats,
  MAX_CHATS,
  moveGuestChats,
  pinChat,
  renameChat,
  reopened,
  saveChats,
  searchChats,
  storageKey,
  titleFrom,
  upsertChat,
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
  titleSource: "auto",
  pinned: false,
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
      "I have 200 USDC. Suggest 3 large US…",
    );
    expect(titleFrom("")).toBe("New chat");
  });
});

describe("groupChats", () => {
  it("groups pinned first, then Today / Yesterday / Previous 7 and 30 days / Older", () => {
    const now = new Date(2026, 9, 10, 15, 0);
    const at = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
    const groups = groupChats(
      [
        chat("old", new Date(2026, 7, 1).getTime()),
        chat("month", at(1)),
        chat("pinned-old", new Date(2025, 0, 1).getTime(), { pinned: true }),
        chat("today-early", at(10, 1)),
        chat("yday", at(9)),
        chat("week", at(5)),
        chat("today", at(10, 14)),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.chats.map((c) => c.id)])).toEqual([
      ["Pinned", ["pinned-old"]],
      ["Today", ["today", "today-early"]],
      ["Yesterday", ["yday"]],
      ["Previous 7 days", ["week"]],
      ["Previous 30 days", ["month"]],
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

const reply = (text: string, buy?: Extract<ChatTurn, { role: "assistant" }>["buy"]): ChatTurn => ({
  role: "assistant",
  text,
  tools: [],
  progress: "",
  done: true,
  buy,
});

describe("chat list changes", () => {
  const turns: ChatTurn[] = [{ role: "user", text: "Compare NVDA and AMD" }, reply("Here you go")];

  it("creates a chat on its first save, titled from the first message, and updates it after", () => {
    let chats = upsertChat([], "c1", turns, ["h"], 100);
    expect(chats).toEqual([
      expect.objectContaining({
        id: "c1",
        title: "Compare NVDA and AMD",
        titleSource: "auto",
        pinned: false,
        createdAt: 100,
        updatedAt: 100,
      }),
    ]);
    chats = upsertChat(chats, "c1", [...turns, { role: "user", text: "and INTC?" }], ["h2"], 200);
    expect(chats[0]).toMatchObject({ createdAt: 100, updatedAt: 200, history: ["h2"] });
    expect(chats[0]!.turns).toHaveLength(3);
  });

  it("renames (trimmed, never empty) and keeps the name over later saves and AI titles", () => {
    let chats = upsertChat([], "c1", turns, [], 1);
    expect(renameChat(chats, "c1", "   ")).toBe(chats);
    chats = renameChat(chats, "c1", "  Chip   makers ");
    expect(chats[0]).toMatchObject({ title: "Chip makers", titleSource: "user" });
    chats = applyAiTitle(chats, "c1", "Comparing NVDA and AMD");
    chats = upsertChat(chats, "c1", turns, [], 2);
    expect(chats[0]!.title).toBe("Chip makers");
  });

  it("upgrades only the automatic title to the AI one", () => {
    const chats = applyAiTitle(upsertChat([], "c1", turns, [], 1), "c1", "Comparing NVDA and AMD");
    expect(chats[0]).toMatchObject({ title: "Comparing NVDA and AMD", titleSource: "ai" });
    expect(upsertChat(chats, "c1", turns, [], 2)[0]!.title).toBe("Comparing NVDA and AMD");
  });

  it("pins and unpins, and deletes", () => {
    const chats = [chat("a", 1), chat("b", 2)];
    expect(pinChat(chats, "a", true).find((c) => c.id === "a")!.pinned).toBe(true);
    expect(pinChat(pinChat(chats, "a", true), "a", false)[0]!.pinned).toBe(false);
    expect(deleteChat(chats, "a").map((c) => c.id)).toEqual(["b"]);
  });

  it("searches titles and message text, case-insensitively, every word", () => {
    const chats = [
      chat("t1", 3, { title: "Energy ETFs" }),
      chat("t2", 2, { turns: [{ role: "user", text: "hi" }, reply("NVIDIA leads on return")] }),
      chat("t3", 1, { title: "Banks" }),
    ];
    expect(searchChats(chats, "energy").map((c) => c.id)).toEqual(["t1"]);
    expect(searchChats(chats, "nvidia RETURN").map((c) => c.id)).toEqual(["t2"]);
    expect(searchChats(chats, "nvidia banks")).toEqual([]);
    expect(searchChats(chats, "  ")).toBe(chats);
  });

  it(`keeps at most ${MAX_CHATS} chats, dropping the oldest unpinned first`, () => {
    const many = Array.from({ length: MAX_CHATS + 2 }, (_, i) =>
      chat(`c${i}`, i + 10, { pinned: i === 0 }),
    );
    const kept = capChats(many);
    expect(kept).toHaveLength(MAX_CHATS);
    expect(kept.some((c) => c.id === "c0")).toBe(true); // oldest, but pinned
    expect(kept.some((c) => c.id === "c1" || c.id === "c2")).toBe(false);
    expect(kept[0]!.id).toBe(`c${MAX_CHATS + 1}`);
  });

  it("flags chats with a purchase", () => {
    const item = {
      symbol: "NVDAx",
      name: "NVIDIA",
      mint: "m",
      decimals: 8,
      usdcAmount: 5,
      signature: "sig",
      outAmount: "1",
      error: null,
    };
    expect(hasPurchase({ turns })).toBe(false);
    expect(
      hasPurchase({ turns: [reply("x", { stopped: null, items: [{ ...item, step: "failed" }] })] }),
    ).toBe(false);
    expect(
      hasPurchase({ turns: [reply("x", { stopped: null, items: [{ ...item, step: "bought" }] })] }),
    ).toBe(true);
  });
});

describe("AI titles", () => {
  it("accepts a short plain title and rejects long or empty answers", () => {
    expect(cleanAiTitle('"**Top tech stocks for 200 USDC**."')).toBe(
      "Top tech stocks for 200 USDC",
    );
    expect(cleanAiTitle("Title: Comparing NVDA and AMD\nextra")).toBe("Comparing NVDA and AMD");
    expect(cleanAiTitle("")).toBeNull();
    expect(cleanAiTitle("one two three four five six seven eight nine")).toBeNull();
  });
});

describe("storage per wallet", () => {
  it("keeps each wallet's history separate", () => {
    const storage = fakeStorage();
    saveChats(storage, "walletA", [chat("a1", 1)]);
    saveChats(storage, "walletB", [chat("b1", 2)]);
    expect(loadChats(storage, "walletA").map((c) => c.id)).toEqual(["a1"]);
    expect(loadChats(storage, "walletB").map((c) => c.id)).toEqual(["b1"]);
    clearChats(storage, "walletA");
    expect(loadChats(storage, "walletA")).toEqual([]);
    expect(loadChats(storage, "walletB")).toHaveLength(1);
  });

  it("moves guest chats to the wallet that connects, merging and emptying the guest list", () => {
    const storage = fakeStorage();
    saveChats(storage, GUEST, [chat("g1", 5), chat("shared", 9, { title: "newer" })]);
    saveChats(storage, "walletA", [chat("a1", 1), chat("shared", 3, { title: "older" })]);
    const moved = moveGuestChats(storage, "walletA");
    expect(moved.map((c) => c.id)).toEqual(["shared", "g1", "a1"]);
    expect(moved[0]!.title).toBe("newer");
    expect(loadChats(storage, GUEST)).toEqual([]);
    expect(loadChats(storage, "walletB")).toEqual([]);
  });

  it("restores the open chat after a reload from its /chat/[id] URL", () => {
    const storage = fakeStorage();
    const turns: ChatTurn[] = [{ role: "user", text: "Tell me about NVDA" }, reply("NVIDIA is…")];
    saveChats(storage, "walletA", upsertChat([], "abc-123", turns, ["h"], 1));
    const id = chatIdFromPath("/chat/abc-123");
    const restored = loadChats(storage, "walletA").find((c) => c.id === id);
    expect(restored).toMatchObject({ id: "abc-123", turns, history: ["h"] });
    expect(chatIdFromPath("/chat")).toBeNull();
    expect(chatIdFromPath("/chat/a%20b")).toBe("a b");
  });

  it("reads chats saved before pins and AI titles", () => {
    const storage = fakeStorage();
    const legacy = { ...chat("old", 1), renamed: true } as Partial<StoredChat> & {
      renamed: boolean;
    };
    delete legacy.titleSource;
    delete legacy.pinned;
    storage.setItem(storageKey("w"), JSON.stringify([legacy]));
    expect(loadChats(storage, "w")[0]).toMatchObject({ titleSource: "user", pinned: false });
    expect(loadChats(storage, "w")[0]).not.toHaveProperty("renamed");
  });

  it("keeps working when storage throws on every call", () => {
    const broken: Storage = {
      length: 0,
      clear: () => {
        throw new Error("blocked");
      },
      getItem: () => {
        throw new Error("blocked");
      },
      key: () => null,
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(loadChats(broken, "w")).toEqual([]);
    const chats = [chat("a", 2), chat("b", 1)];
    // Nothing can be stored: every chat stays in memory for this visit.
    expect(saveChats(broken, "w", chats).map((c) => c.id)).toEqual(["a", "b"]);
    expect(() => clearChats(broken, "w")).not.toThrow();
    expect(() => moveGuestChats(broken, "w")).not.toThrow();
  });
});

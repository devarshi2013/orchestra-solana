import type { ChatTurn } from "@/hooks/use-agent-chat";

/**
 * Past conversations, kept in this browser only (localStorage, no database).
 * Each wallet has its own list, and chats from before a wallet connects go
 * in a "guest" list that can be moved to the wallet. Every storage call is
 * wrapped: private windows, blocked storage or a full quota never break the
 * chat, they just mean history isn't kept.
 */

export type TitleSource = "auto" | "ai" | "user";

export type StoredChat = {
  id: string;
  title: string;
  /** Where the title came from: the first message, the AI, or the user (never replaced). */
  titleSource: TitleSource;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  /** Messages, plans and each plan's purchase (statuses and Solscan signatures). */
  turns: ChatTurn[];
  /** The model-side history to continue the conversation (null once pruned to save space). */
  history: unknown[] | null;
};

/** Whose list: a wallet address, or the guest list before a wallet connects. */
export type Owner = string;
export const GUEST: Owner = "guest";

export const STORAGE_PREFIX = "askfirst.chats.v1.";
export const MAX_CHATS = 200;
const TITLE_LENGTH = 40;

export const storageKey = (owner: Owner) => STORAGE_PREFIX + owner;

/** A title from the first message: one line, cut at a word near 40 characters. */
export function titleFrom(message: string): string {
  const line = message.replace(/\s+/g, " ").trim();
  if (line.length <= TITLE_LENGTH) return line || "New chat";
  const cut = line.slice(0, TITLE_LENGTH);
  const space = cut.lastIndexOf(" ");
  return `${(space > 20 ? cut.slice(0, space) : cut).replace(/[,.;:!?-]+$/, "")}…`;
}

/** A model-written title made safe to show: one line, no quotes or Markdown, 1-8 words. */
export function cleanAiTitle(raw: string): string | null {
  const title = raw
    .split("\n")[0]!
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*(title\s*:\s*)/i, "")
    .replace(/^["'“‘\s]+|["'”’.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = title.split(" ").filter(Boolean).length;
  if (!title || words > 8 || title.length > 60) return null;
  return title;
}

/** True once any item of any plan in the chat was bought (or sent and landed). */
export function hasPurchase(chat: Pick<StoredChat, "turns">): boolean {
  return chat.turns.some(
    (t) => t.role === "assistant" && t.buy?.items.some((item) => item.step === "bought"),
  );
}

/** The chat id in a /chat/[id] path, or null for /chat. */
export function chatIdFromPath(pathname: string | null): string | null {
  const match = /^\/chat\/([^/?#]+)/.exec(pathname ?? "");
  return match ? decodeURIComponent(match[1]!) : null;
}

/**
 * A stored conversation as it should reopen: a reply cut off mid-stream is
 * marked as interrupted, and a buy cut off mid-swap says to check the wallet
 * (a swap that was sending may have landed).
 */
export function reopened(turns: ChatTurn[]): ChatTurn[] {
  return turns.map((turn) => {
    if (turn.role !== "assistant") return turn;
    const buy = turn.buy && {
      ...turn.buy,
      items: turn.buy.items.map((item) =>
        item.step === "quoting" || item.step === "signing"
          ? { ...item, step: "failed" as const, error: "Interrupted before it was signed." }
          : item.step === "sending"
            ? {
                ...item,
                step: "failed" as const,
                error:
                  "The page closed while this swap was sending. Check your wallet before retrying.",
              }
            : item,
      ),
    };
    return turn.done
      ? { ...turn, buy }
      : {
          ...turn,
          buy,
          done: true,
          progress: "",
          error: turn.error ?? "This reply was interrupted.",
        };
  });
}

// --- Changes to a list (pure) -------------------------------------------------

const byRecent = (a: StoredChat, b: StoredChat) => b.updatedAt - a.updatedAt;

/** Newest first, at most `max`: the oldest unpinned chats go first. */
export function capChats(chats: StoredChat[], max = MAX_CHATS): StoredChat[] {
  const sorted = [...chats].sort(byRecent);
  let excess = sorted.length - max;
  if (excess <= 0) return sorted;
  const drop = new Set<string>();
  for (let i = sorted.length - 1; i >= 0 && excess > 0; i--) {
    if (!sorted[i]!.pinned) {
      drop.add(sorted[i]!.id);
      excess--;
    }
  }
  // Only pinned chats left over the cap: drop the oldest of those too.
  const kept = sorted.filter((c) => !drop.has(c.id));
  return kept.slice(0, max);
}

/** Stores the conversation under `id`, creating the chat on its first save. */
export function upsertChat(
  chats: StoredChat[],
  id: string,
  turns: ChatTurn[],
  history: unknown[],
  now: number,
): StoredChat[] {
  const existing = chats.find((c) => c.id === id);
  const firstMessage = turns.find((t) => t.role === "user")?.text ?? "";
  const chat: StoredChat = {
    id,
    title: existing && existing.titleSource !== "auto" ? existing.title : titleFrom(firstMessage),
    titleSource: existing?.titleSource ?? "auto",
    pinned: existing?.pinned ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    turns,
    history,
  };
  return capChats([chat, ...chats.filter((c) => c.id !== id)]);
}

export function renameChat(chats: StoredChat[], id: string, title: string): StoredChat[] {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!clean) return chats;
  return chats.map((c) => (c.id === id ? { ...c, title: clean, titleSource: "user" } : c));
}

/** The AI's title replaces only the automatic one, never a name the user chose. */
export function applyAiTitle(chats: StoredChat[], id: string, title: string): StoredChat[] {
  return chats.map((c) =>
    c.id === id && c.titleSource === "auto" ? { ...c, title, titleSource: "ai" } : c,
  );
}

export function pinChat(chats: StoredChat[], id: string, pinned: boolean): StoredChat[] {
  return chats.map((c) => (c.id === id ? { ...c, pinned } : c));
}

export function deleteChat(chats: StoredChat[], id: string): StoredChat[] {
  return chats.filter((c) => c.id !== id);
}

/** Both lists in one; for the same id the more recently updated copy wins. */
export function mergeChats(target: StoredChat[], incoming: StoredChat[]): StoredChat[] {
  const byId = new Map(target.map((c) => [c.id, c]));
  for (const chat of incoming) {
    const existing = byId.get(chat.id);
    if (!existing || chat.updatedAt > existing.updatedAt) byId.set(chat.id, chat);
  }
  return capChats([...byId.values()]);
}

/** Chats whose title or any message contains every word of `query` (case-insensitive). */
export function searchChats(chats: StoredChat[], query: string): StoredChat[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return chats;
  return chats.filter((chat) => {
    const text = [chat.title, ...chat.turns.map((t) => t.text)].join("\n").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export type ChatGroup = { label: string; chats: StoredChat[] };

/**
 * Pinned first, then Today / Yesterday / Previous 7 days / Previous 30 days /
 * Older by last activity in local time, each newest first.
 */
export function groupChats(chats: StoredChat[], now: Date): ChatGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  const bounds: [string, number][] = [
    ["Today", startOfToday],
    ["Yesterday", startOfToday - day],
    ["Previous 7 days", startOfToday - 7 * day],
    ["Previous 30 days", startOfToday - 30 * day],
    ["Older", Number.NEGATIVE_INFINITY],
  ];
  const sorted = [...chats].sort(byRecent);
  const pinned: ChatGroup = { label: "Pinned", chats: sorted.filter((c) => c.pinned) };
  const groups = bounds.map(([label]) => ({ label, chats: [] as StoredChat[] }));
  for (const chat of sorted) {
    if (chat.pinned) continue;
    const index = bounds.findIndex(([, from]) => chat.updatedAt >= from);
    groups[index]!.chats.push(chat);
  }
  return [pinned, ...groups].filter((g) => g.chats.length > 0);
}

// --- Storage ------------------------------------------------------------------

function isStoredChat(value: unknown): value is StoredChat {
  const c = value as StoredChat;
  return (
    typeof c === "object" &&
    c !== null &&
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    typeof c.updatedAt === "number" &&
    Array.isArray(c.turns)
  );
}

/** Chats saved before pins and AI titles had `renamed` instead of `titleSource`. */
function migrate(chat: StoredChat & { renamed?: boolean }): StoredChat {
  const { renamed, ...rest } = chat;
  return {
    ...rest,
    titleSource:
      rest.titleSource === "ai" || rest.titleSource === "user" || rest.titleSource === "auto"
        ? rest.titleSource
        : renamed
          ? "user"
          : "auto",
    pinned: rest.pinned === true,
    createdAt: typeof rest.createdAt === "number" ? rest.createdAt : rest.updatedAt,
    history: Array.isArray(rest.history) ? rest.history : null,
    turns: reopened(rest.turns),
  };
}

/** The owner's chats, newest first; [] when storage is unavailable or unreadable. */
export function loadChats(storage: Storage | undefined, owner: Owner): StoredChat[] {
  try {
    const raw = storage?.getItem(storageKey(owner));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredChat).map(migrate).sort(byRecent);
  } catch {
    return [];
  }
}

/**
 * Saves the owner's chats (at most MAX_CHATS). When the quota is full it
 * frees space step by step: first the model-side history of the oldest chats
 * (they still show, but continue as a fresh conversation), then whole chats,
 * oldest unpinned first. Returns what was stored, or everything (kept in
 * memory only) when storage won't take even one chat. Never throws.
 */
export function saveChats(
  storage: Storage | undefined,
  owner: Owner,
  chats: StoredChat[],
): StoredChat[] {
  const all = capChats(chats);
  let kept = all;
  if (!storage) return kept;
  for (;;) {
    try {
      storage.setItem(storageKey(owner), JSON.stringify(kept));
      return kept;
    } catch {
      let oldestWithHistory = -1;
      for (let i = kept.length - 1; i > 0; i--) {
        if (kept[i]!.history !== null) {
          oldestWithHistory = i;
          break;
        }
      }
      if (oldestWithHistory > 0) {
        kept = kept.map((c, i) => (i === oldestWithHistory ? { ...c, history: null } : c));
      } else if (kept.length > 1) {
        kept = capChats(kept, kept.length - 1);
      } else {
        // Storage refuses even one chat (blocked, or broken): keep them all in memory for this visit.
        return all;
      }
    }
  }
}

/** Removes every chat of `owner` from this browser. */
export function clearChats(storage: Storage | undefined, owner: Owner): void {
  try {
    storage?.removeItem(storageKey(owner));
  } catch {
    // Storage blocked: nothing was kept anyway.
  }
}

/**
 * Moves the guest chats into `wallet`'s list and empties the guest list.
 * Returns the wallet's chats afterwards.
 */
export function moveGuestChats(storage: Storage | undefined, wallet: Owner): StoredChat[] {
  const guest = loadChats(storage, GUEST);
  const merged = mergeChats(loadChats(storage, wallet), guest);
  const saved = saveChats(storage, wallet, merged);
  clearChats(storage, GUEST);
  return saved;
}

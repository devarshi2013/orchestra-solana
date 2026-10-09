import type { ChatTurn } from "@/hooks/use-agent-chat";

/**
 * Past conversations, kept in this browser only (localStorage, no database),
 * one list per wallet so each wallet sees its own chats. Every storage call is
 * wrapped: private windows, blocked storage or a full quota never break the
 * chat, they just mean history isn't kept.
 */

export type StoredChat = {
  id: string;
  title: string;
  /** True once the user renamed it; the title is no longer derived. */
  renamed: boolean;
  createdAt: number;
  updatedAt: number;
  turns: ChatTurn[];
  /** The model-side history to continue the conversation (null once pruned to save space). */
  history: unknown[] | null;
};

export const STORAGE_PREFIX = "askfirst.chats.v1.";
export const MAX_CHATS = 50;
const TITLE_LENGTH = 48;

export const storageKey = (wallet: string) => STORAGE_PREFIX + wallet;

/** A title from the first message: one line, cut at a word near 48 characters. */
export function titleFrom(message: string): string {
  const line = message.replace(/\s+/g, " ").trim();
  if (line.length <= TITLE_LENGTH) return line || "New chat";
  const cut = line.slice(0, TITLE_LENGTH);
  const space = cut.lastIndexOf(" ");
  return `${(space > 24 ? cut.slice(0, space) : cut).replace(/[,.;:!?-]+$/, "")}…`;
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

/** The wallet's chats, newest first; [] when storage is unavailable or unreadable. */
export function loadChats(storage: Storage | undefined, wallet: string): StoredChat[] {
  try {
    const raw = storage?.getItem(storageKey(wallet));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isStoredChat)
      .map((c) => ({ ...c, renamed: Boolean(c.renamed), turns: reopened(c.turns) }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Saves the wallet's chats (at most MAX_CHATS). When the quota is full it
 * frees space step by step: first the model-side history of the oldest chats
 * (they still show, but continue as a fresh conversation), then whole chats,
 * oldest first. Returns what was actually stored.
 */
export function saveChats(
  storage: Storage | undefined,
  wallet: string,
  chats: StoredChat[],
): StoredChat[] {
  if (!storage) return chats;
  let kept = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
  for (;;) {
    try {
      storage.setItem(storageKey(wallet), JSON.stringify(kept));
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
        kept = kept.slice(0, -1);
      } else {
        return kept; // Even one chat doesn't fit: keep it in memory only.
      }
    }
  }
}

export type ChatGroup = { label: string; chats: StoredChat[] };

/** Today / Yesterday / Previous 7 days / Older, by last activity in local time. */
export function groupChats(chats: StoredChat[], now: Date): ChatGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  const bounds: [string, number][] = [
    ["Today", startOfToday],
    ["Yesterday", startOfToday - day],
    ["Previous 7 days", startOfToday - 7 * day],
    ["Older", Number.NEGATIVE_INFINITY],
  ];
  const groups = bounds.map(([label]) => ({ label, chats: [] as StoredChat[] }));
  for (const chat of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const index = bounds.findIndex(([, from]) => chat.updatedAt >= from);
    groups[index]!.chats.push(chat);
  }
  return groups.filter((g) => g.chats.length > 0);
}

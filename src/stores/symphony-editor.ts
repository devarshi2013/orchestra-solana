import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { EXAMPLE_TOKEN_SYMBOLS, solTrendFollower } from "@/lib/symphony/examples";
import type { Symphony, SymphonyNode } from "@/lib/symphony/types";
import { DEFAULT_TOKENS, type TokenInfo } from "@/lib/tokens";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type EditorState = {
  /** Postgres id of the draft; null until the first autosave picks one. */
  draftId: string | null;
  symphony: Symphony;
  /** Bumped on every edit, so autosave can tell a newer edit from the one it saved. */
  revision: number;
  /** Token metadata for mints in the tree (picked, or looked up by mint). */
  tokens: Record<string, TokenInfo>;
  saveStatus: SaveStatus;
  savedRevision: number;
  savedAt: string | null;

  setName: (name: string) => void;
  editRoot: (edit: (root: SymphonyNode) => SymphonyNode) => void;
  /** Replaces the whole draft (JSON edit, example, loaded draft). */
  loadSymphony: (symphony: Symphony, draftId?: string | null) => void;
  rememberTokens: (tokens: readonly TokenInfo[]) => void;
  setDraftId: (id: string) => void;
  setSaveStatus: (status: SaveStatus, revision?: number, savedAt?: string) => void;
};

/** Tokens we can name before any lookup: the swap defaults and the examples' mints. */
const SEED_TOKENS: Record<string, TokenInfo> = Object.fromEntries([
  ...Object.entries(EXAMPLE_TOKEN_SYMBOLS).map(([mint, symbol]) => [
    mint,
    {
      mint,
      symbol,
      name: symbol,
      decimals: 0,
      icon: null,
      isVerified: true,
      isSus: false,
      liquidity: null,
    },
  ]),
  ...DEFAULT_TOKENS.map((token) => [token.mint, token]),
]);

/**
 * The /create draft. Persisted to localStorage so a reload never loses work;
 * hooks/use-draft-autosave.ts mirrors it to Postgres.
 */
export const useSymphonyEditor = create<EditorState>()(
  persist(
    (set) => ({
      draftId: null,
      symphony: structuredClone(solTrendFollower),
      revision: 0,
      tokens: SEED_TOKENS,
      saveStatus: "idle",
      savedRevision: 0,
      savedAt: null,

      setName: (name) =>
        set((s) => ({ symphony: { ...s.symphony, name }, revision: s.revision + 1 })),
      editRoot: (edit) =>
        set((s) => ({
          symphony: { ...s.symphony, root: edit(s.symphony.root) },
          revision: s.revision + 1,
        })),
      loadSymphony: (symphony, draftId) =>
        set((s) => ({
          symphony,
          revision: s.revision + 1,
          ...(draftId === undefined ? {} : { draftId }),
        })),
      rememberTokens: (tokens) =>
        set((s) => ({
          tokens: { ...s.tokens, ...Object.fromEntries(tokens.map((t) => [t.mint, t])) },
        })),
      setDraftId: (draftId) => set({ draftId }),
      setSaveStatus: (saveStatus, revision, savedAt) =>
        set((s) => ({
          saveStatus,
          savedRevision: revision ?? s.savedRevision,
          savedAt: savedAt ?? s.savedAt,
        })),
    }),
    {
      name: "orchestra:create-draft",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ draftId, symphony, revision, tokens, savedRevision, savedAt }) => ({
        draftId,
        symphony,
        revision,
        tokens,
        savedRevision,
        savedAt,
      }),
      // Rehydrated on mount by the editor, so server and first client render match.
      skipHydration: true,
    },
  ),
);

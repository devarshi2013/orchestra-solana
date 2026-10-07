"use client";

import { createContext, useContext } from "react";

import type { ValidationIssue } from "@/lib/symphony/validate";
import type { SymphonyNode } from "@/lib/symphony/types";
import type { TokenInfo } from "@/lib/tokens";

/** Shared with every node card, so the recursive tree doesn't drill props. */
export type EditorContextValue = {
  issues: readonly ValidationIssue[];
  tokenOf: (mint: string) => TokenInfo | undefined;
  rememberToken: (token: TokenInfo) => void;
  edit: (change: (root: SymphonyNode) => SymphonyNode) => void;
  /** Path of the card being dragged, if any. */
  dragging: string | null;
  setDragging: (path: string | null) => void;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor outside <EditorContext>");
  return value;
}

/** A display label for a mint: its symbol, or a shortened address. */
export function useSymbolOf(): (mint: string) => string {
  const { tokenOf } = useEditor();
  return (mint) => tokenOf(mint)?.symbol ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

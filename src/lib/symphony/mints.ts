import type { SymphonyNode } from "./types";

/** Every mint a tree holds or reads indicators from, in first-seen order. */
export function collectMints(node: SymphonyNode, into: Set<string> = new Set()): Set<string> {
  switch (node.type) {
    case "asset":
      into.add(node.mint);
      break;
    case "if": {
      const { left, right } = node.condition;
      into.add(left.mint);
      if (typeof right !== "number") into.add(right.mint);
      collectMints(node.then, into);
      collectMints(node.else, into);
      break;
    }
    case "group":
    case "filter":
      node.children.forEach((child) => collectMints(child, into));
      break;
  }
  return into;
}

import { describe, expect, it } from "vitest";

import {
  emptyGroup,
  formatPath,
  getNode,
  insertNode,
  isWithin,
  issuesForNode,
  moveNode,
  newFilter,
  newIf,
  parsePath,
  removeNode,
  reorderNode,
  updateNode,
} from "./edit";
import type { GroupNode, SymphonyNode } from "./types";

const asset = (mint: string): SymphonyNode => ({ type: "asset", mint });
const specified = (percentages: number[], children: SymphonyNode[]): GroupNode => ({
  type: "group",
  name: "s",
  weight: { method: "specified", percentages },
  children,
});

/** root: 60/40 group of [A, if(then: group[B, C], else: D)] */
const tree = (): SymphonyNode =>
  specified(
    [60, 40],
    [
      asset("A"),
      {
        ...newIf("A"),
        then: { ...emptyGroup("Then"), children: [asset("B"), asset("C")] },
        else: asset("D"),
      },
    ],
  );

/** Mints in depth-first order, for compact assertions. */
const mints = (node: SymphonyNode): string[] => {
  switch (node.type) {
    case "asset":
      return [node.mint];
    case "if":
      return [...mints(node.then), "|", ...mints(node.else)];
    default:
      return ["[", ...node.children.flatMap(mints), "]"];
  }
};
const percentages = (node: SymphonyNode) =>
  node.type === "group" && node.weight.method === "specified" ? node.weight.percentages : null;

describe("paths", () => {
  it("round-trips and rejects junk", () => {
    const path = "root.children[1].then.children[0]";
    expect(formatPath(parsePath(path))).toBe(path);
    expect(parsePath("root")).toEqual([]);
    expect(() => parsePath("children[0]")).toThrow();
    expect(() => parsePath("root.kids[0]")).toThrow();
  });

  it("finds nodes, or undefined for paths that don't exist", () => {
    expect(getNode(tree(), "root.children[1].then.children[1]")).toEqual(asset("C"));
    expect(getNode(tree(), "root.children[1].else")).toEqual(asset("D"));
    expect(getNode(tree(), "root.children[5]")).toBeUndefined();
    expect(getNode(tree(), "root.then")).toBeUndefined();
    expect(getNode(tree(), "root.children[0].children[0]")).toBeUndefined();
    expect(getNode(tree(), "root.children[7].then")).toBeUndefined();
  });

  it("knows ancestry", () => {
    expect(isWithin("root.children[1].then", "root.children[1]")).toBe(true);
    expect(isWithin("root.children[10]", "root.children[1]")).toBe(false);
  });
});

describe("updateNode", () => {
  it("replaces one node immutably", () => {
    const before = tree();
    const after = updateNode(before, "root.children[1].else", () => asset("E"));
    expect(mints(after)).toEqual(["[", "A", "[", "B", "C", "]", "|", "E", "]"]);
    expect(mints(before)).toContain("D");
  });

  it("throws on a path through the wrong node type", () => {
    expect(() => updateNode(tree(), "root.then", (n) => n)).toThrow("No then branch");
    expect(() => updateNode(tree(), "root.children[9]", (n) => n)).toThrow("No such child");
  });
});

describe("insertNode / removeNode", () => {
  it("keeps specified percentages aligned", () => {
    const inserted = insertNode(tree(), "root", 1, asset("X"), 5);
    expect(mints(inserted).slice(0, 3)).toEqual(["[", "A", "X"]);
    expect(percentages(inserted)).toEqual([60, 5, 40]);
    const removed = removeNode(inserted, "root.children[0]");
    expect(percentages(removed)).toEqual([5, 40]);
  });

  it("inserts into equal-weight groups and filters without percentages", () => {
    const filter = insertNode(newFilter(), "root", 0, asset("A"));
    expect(filter).toMatchObject({ type: "filter", children: [asset("A")] });
    expect(() => insertNode(asset("A"), "root", 0, asset("B"))).toThrow("can't hold children");
  });

  it("empties an if branch or the root instead of deleting them", () => {
    expect(getNode(removeNode(tree(), "root.children[1].else"), "root.children[1].else")).toEqual(
      emptyGroup(),
    );
    expect(removeNode(tree(), "root")).toEqual(emptyGroup());
  });
});

describe("reorderNode", () => {
  it("swaps siblings with their percentages", () => {
    const moved = reorderNode(tree(), "root.children[0]", 1);
    expect(mints(moved)).toEqual(["[", "[", "B", "C", "]", "|", "D", "A", "]"]);
    expect(percentages(moved)).toEqual([40, 60]);
  });

  it("ignores moves past either end and non-list nodes", () => {
    expect(reorderNode(tree(), "root.children[0]", -1)).toEqual(tree());
    expect(reorderNode(tree(), "root.children[1].else", 1)).toEqual(tree());
  });
});

describe("moveNode", () => {
  it("reorders within a parent, keeping the percentage", () => {
    const moved = moveNode(tree(), "root.children[0]", "root", 2);
    expect(mints(moved)).toEqual(["[", "[", "B", "C", "]", "|", "D", "A", "]"]);
    expect(percentages(moved)).toEqual([40, 60]);
  });

  it("reparents into a nested group, shifting the target path after removal", () => {
    // A (children[0]) moves into the then-group, which shifts from children[1] to children[0].
    const moved = moveNode(tree(), "root.children[0]", "root.children[1].then", 1);
    expect(mints(moved)).toEqual(["[", "[", "B", "A", "C", "]", "|", "D", "]"]);
    expect(percentages(moved)).toEqual([40]);
  });

  it("moves an if branch out, leaving an empty group behind", () => {
    const moved = moveNode(tree(), "root.children[1].else", "root", 0);
    expect(mints(moved)).toEqual(["[", "D", "A", "[", "B", "C", "]", "|", "[", "]", "]"]);
    expect(percentages(moved)).toEqual([0, 60, 40]);
  });

  it("moves out of a nested list into an ancestor", () => {
    const moved = moveNode(tree(), "root.children[1].then.children[0]", "root", 0);
    expect(mints(moved)).toEqual(["[", "B", "A", "[", "C", "]", "|", "D", "]"]);
  });

  it("refuses moves into itself, onto non-parents, no-ops and missing nodes", () => {
    const t = tree();
    expect(moveNode(t, "root.children[1]", "root.children[1].then", 0)).toBe(t);
    expect(moveNode(t, "root.children[0]", "root.children[1]", 0)).toBe(t);
    expect(moveNode(t, "root.children[0]", "root", 0)).toBe(t);
    expect(moveNode(t, "root.children[0]", "root", 1)).toBe(t);
    expect(moveNode(t, "root.children[9]", "root", 0)).toBe(t);
  });
});

describe("issuesForNode", () => {
  const issues = [
    { path: "root.weight.percentages", message: "sum" },
    { path: "root.children", message: "empty" },
    { path: "root.children[1].condition.left.mint", message: "unknown" },
    { path: "root.children[1].then.children", message: "empty then" },
    { path: "root.children[10].mint", message: "other" },
  ];

  it("keeps the node's own issues, not its descendants'", () => {
    expect(issuesForNode(issues, "root").map((i) => i.message)).toEqual(["sum", "empty"]);
    expect(issuesForNode(issues, "root.children[1]").map((i) => i.message)).toEqual(["unknown"]);
    expect(issuesForNode(issues, "root.children[1].then").map((i) => i.message)).toEqual([
      "empty then",
    ]);
  });
});

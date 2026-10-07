import type { ValidationIssue } from "./validate";
import type { FilterNode, GroupNode, IfNode, SymphonyNode } from "./types";

/**
 * Immutable tree edits for the visual editor. Nodes are addressed by the same
 * path strings validateSymphony reports (`root`, `root.children[1].then`, …),
 * so an issue maps straight onto its card.
 */

type Step = { child: number } | "then" | "else";
type Parent = GroupNode | FilterNode;

export function parsePath(path: string): Step[] {
  if (path !== "root" && !path.startsWith("root.")) throw new Error(`Bad path: ${path}`);
  const steps: Step[] = [];
  for (const part of path.split(".").slice(1)) {
    const child = /^children\[(\d+)\]$/.exec(part);
    if (child) steps.push({ child: Number(child[1]) });
    else if (part === "then" || part === "else") steps.push(part);
    else throw new Error(`Bad path: ${path}`);
  }
  return steps;
}

export function formatPath(steps: readonly Step[]): string {
  return ["root", ...steps.map((s) => (typeof s === "string" ? s : `children[${s.child}]`))].join(
    ".",
  );
}

const isParent = (node: SymphonyNode): node is Parent =>
  node.type === "group" || node.type === "filter";

export function getNode(root: SymphonyNode, path: string): SymphonyNode | undefined {
  let node: SymphonyNode | undefined = root;
  for (const step of parsePath(path)) {
    if (!node) return undefined;
    if (typeof step === "string") node = node.type === "if" ? node[step] : undefined;
    else node = isParent(node) ? node.children[step.child] : undefined;
  }
  return node;
}

/** Replaces the node at `path` with `update(node)`. */
export function updateNode(
  root: SymphonyNode,
  path: string,
  update: (node: SymphonyNode) => SymphonyNode,
): SymphonyNode {
  const go = (node: SymphonyNode, steps: Step[]): SymphonyNode => {
    const [step, ...rest] = steps;
    if (step === undefined) return update(node);
    if (typeof step === "string") {
      if (node.type !== "if") throw new Error(`No ${step} branch`);
      return { ...node, [step]: go(node[step], rest) };
    }
    if (!isParent(node) || !node.children[step.child]) throw new Error("No such child");
    const children = node.children.map((c, i) => (i === step.child ? go(c, rest) : c));
    return { ...node, children };
  };
  return go(root, parsePath(path));
}

/** Where a node sits: in a parent's children list, or in a slot (root or an if branch). */
function location(path: string): { parent: string; index: number } | null {
  const steps = parsePath(path);
  const last = steps[steps.length - 1];
  return last !== undefined && typeof last !== "string"
    ? { parent: formatPath(steps.slice(0, -1)), index: last.child }
    : null;
}

/** Keeps a specified group's percentages aligned with its children. */
function withChildren(node: Parent, children: SymphonyNode[], percentages?: number[]): Parent {
  if (node.type === "group" && node.weight.method === "specified") {
    return { ...node, children, weight: { method: "specified", percentages: percentages ?? [] } };
  }
  return { ...node, children };
}

function asParent(node: SymphonyNode, path: string): Parent {
  if (!isParent(node)) throw new Error(`${path} can't hold children`);
  return node;
}

function percentagesOf(node: Parent): number[] {
  return node.type === "group" && node.weight.method === "specified"
    ? [...node.weight.percentages]
    : [];
}

/**
 * Inserts `node` into the group or filter at `parentPath` at `index`. A
 * specified-weight group gives it `percentage` (default 0%).
 */
export function insertNode(
  root: SymphonyNode,
  parentPath: string,
  index: number,
  node: SymphonyNode,
  percentage = 0,
): SymphonyNode {
  return updateNode(root, parentPath, (parent) => {
    const p = asParent(parent, parentPath);
    const children = [...p.children];
    const percentages = percentagesOf(p);
    children.splice(index, 0, node);
    percentages.splice(index, 0, percentage);
    return withChildren(p, children, percentages);
  });
}

/**
 * Removes the node at `path`. A list child is spliced out (with its
 * percentage); the root or an if branch can't be empty, so it becomes an
 * empty group for the user to fill.
 */
export function removeNode(root: SymphonyNode, path: string): SymphonyNode {
  const at = location(path);
  if (!at) return path === "root" ? emptyGroup() : updateNode(root, path, () => emptyGroup());
  return updateNode(root, at.parent, (parent) => {
    const p = asParent(parent, at.parent);
    const percentages = percentagesOf(p);
    percentages.splice(at.index, 1);
    return withChildren(
      p,
      p.children.filter((_, i) => i !== at.index),
      percentages,
    );
  });
}

/** Moves a list child up (−1) or down (+1) among its siblings, with its percentage. */
export function reorderNode(root: SymphonyNode, path: string, delta: -1 | 1): SymphonyNode {
  const at = location(path);
  if (!at) return root;
  return updateNode(root, at.parent, (parent) => {
    const p = asParent(parent, at.parent);
    const target = at.index + delta;
    if (target < 0 || target >= p.children.length) return p;
    const swap = <T>(items: T[]) => {
      const next = [...items];
      [next[at.index], next[target]] = [next[target]!, next[at.index]!];
      return next;
    };
    return withChildren(p, swap(p.children), swap(percentagesOf(p)));
  });
}

/** Whether `path` is `ancestor` or inside it. */
export function isWithin(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}.`);
}

/**
 * Drag-and-drop: moves the node at `from` into the group or filter at
 * `toParent`, before the child currently at `toIndex`. Within the same parent
 * it keeps its percentage; into another parent it arrives at 0%. A node can't
 * move into itself. Returns the tree unchanged for impossible moves.
 */
export function moveNode(
  root: SymphonyNode,
  from: string,
  toParent: string,
  toIndex: number,
): SymphonyNode {
  const node = getNode(root, from);
  const parent = getNode(root, toParent);
  if (!node || !parent || !isParent(parent) || isWithin(toParent, from)) return root;

  const source = location(from);
  if (source && source.parent === toParent) {
    const index = toIndex > source.index ? toIndex - 1 : toIndex;
    if (index === source.index) return root;
    const percentage = percentagesOf(parent)[source.index] ?? 0;
    return insertNode(removeNode(root, from), toParent, index, node, percentage);
  }

  // Removing a list child shifts later siblings (and paths through them) up by one.
  const target = source ? shiftAfterRemoval(toParent, source) : toParent;
  return insertNode(removeNode(root, from), target, toIndex, node);
}

function shiftAfterRemoval(path: string, removed: { parent: string; index: number }): string {
  const prefix = parsePath(removed.parent).length;
  const steps = parsePath(path);
  if (!isWithin(path, removed.parent) || steps.length <= prefix) return path;
  const step = steps[prefix]!;
  if (typeof step !== "string" && step.child > removed.index) {
    steps[prefix] = { child: step.child - 1 };
  }
  return formatPath(steps);
}

/** Issues that belong to this node's own card, not to a descendant's. */
export function issuesForNode(issues: readonly ValidationIssue[], path: string): ValidationIssue[] {
  return issues.filter((issue) => {
    if (!isWithin(issue.path, path)) return false;
    const rest = issue.path.slice(path.length);
    return rest === "" || !/^\.(children\[\d+\]|then|else)(\.|$)/.test(rest);
  });
}

export const emptyGroup = (name = "Group"): GroupNode => ({
  type: "group",
  name,
  weight: { method: "equal" },
  children: [],
});

export const newIf = (mint: string): IfNode => ({
  type: "if",
  condition: {
    left: { mint, indicator: { fn: "price" } },
    comparator: "gt",
    right: { mint, indicator: { fn: "sma", period: 50 } },
  },
  then: emptyGroup("Then"),
  else: emptyGroup("Else"),
});

export const newFilter = (): FilterNode => ({
  type: "filter",
  sortBy: { fn: "cumulativeReturn", period: 30 },
  select: { direction: "top", count: 3 },
  children: [],
});

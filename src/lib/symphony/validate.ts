import type { AssetIndicator, Symphony, SymphonyNode } from "./types";

export type ValidationIssue = {
  /** Where in the tree, e.g. `root.children[1].then`. */
  path: string;
  message: string;
};

export type ValidateOptions = {
  /** Whether a mint is a token we know (e.g. present in Jupiter's token list). */
  isKnownMint: (mint: string) => boolean;
};

/** Floating-point slack when summing percentages like 33.33 + 33.33 + 33.34. */
const SUM_TOLERANCE = 1e-6;

/**
 * Semantic checks on a structurally valid symphony (see schema.ts): specified
 * weights sum to 100 with one per child, groups and filters are not empty, and
 * every mint is known. Returns every issue, not just the first, so an editor
 * can highlight them all.
 */
export function validateSymphony(symphony: Symphony, options: ValidateOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const report = (path: string, message: string) => issues.push({ path, message });
  const checkMint = (path: string, mint: string) => {
    if (!options.isKnownMint(mint)) report(path, `Unknown token mint ${mint}`);
  };
  const checkIndicator = (path: string, { mint }: AssetIndicator) =>
    checkMint(`${path}.mint`, mint);

  const visit = (node: SymphonyNode, path: string) => {
    switch (node.type) {
      case "asset":
        checkMint(`${path}.mint`, node.mint);
        return;
      case "if": {
        const { left, right } = node.condition;
        checkIndicator(`${path}.condition.left`, left);
        if (typeof right !== "number") checkIndicator(`${path}.condition.right`, right);
        visit(node.then, `${path}.then`);
        visit(node.else, `${path}.else`);
        return;
      }
      case "group":
      case "filter": {
        if (node.children.length === 0) {
          report(`${path}.children`, `${node.type === "group" ? "Group" : "Filter"} is empty`);
        }
        if (node.type === "group" && node.weight.method === "specified") {
          const { percentages } = node.weight;
          if (percentages.length !== node.children.length) {
            report(
              `${path}.weight.percentages`,
              `Expected ${node.children.length} percentages (one per child), got ${percentages.length}`,
            );
          }
          const sum = percentages.reduce((total, p) => total + p, 0);
          if (Math.abs(sum - 100) > SUM_TOLERANCE) {
            report(`${path}.weight.percentages`, `Weights must sum to 100%, got ${sum}%`);
          }
        }
        node.children.forEach((child, i) => visit(child, `${path}.children[${i}]`));
        return;
      }
    }
  };

  visit(symphony.root, "root");
  return issues;
}

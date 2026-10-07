/** Rules for a rebalance run's legs, which execute strictly in order. */

export type LegStatus = "pending" | "quoted" | "executing" | "succeeded" | "failed" | "skipped";
export type RunStatus = "planned" | "executing" | "completed" | "partial" | "cancelled";

const done = (status: LegStatus) => status === "succeeded" || status === "skipped";

/**
 * - completed: every leg succeeded or was skipped;
 * - partial: a leg failed; the run stops there until resumed or cancelled;
 * - planned: nothing has started;
 * - executing: otherwise.
 */
export function deriveRunStatus(
  legs: readonly { status: LegStatus }[],
): Exclude<RunStatus, "cancelled"> {
  if (legs.every((leg) => done(leg.status))) return "completed";
  if (legs.some((leg) => leg.status === "failed")) return "partial";
  if (legs.every((leg) => leg.status === "pending")) return "planned";
  return "executing";
}

/** The leg to run next: the first one not yet done. */
export function nextLegIndex(legs: readonly { index: number; status: LegStatus }[]): number | null {
  return (
    [...legs].sort((a, b) => a.index - b.index).find((leg) => !done(leg.status))?.index ?? null
  );
}

/**
 * Whether leg `index` may be (re)quoted now: every earlier leg is done (so
 * buys only start once all sells are in), and it isn't mid-execution or done.
 */
export function canQuoteLeg(
  legs: readonly { index: number; status: LegStatus }[],
  index: number,
): string | null {
  const leg = legs.find((l) => l.index === index);
  if (!leg) return "No such leg";
  if (done(leg.status)) return "This leg is already done";
  if (leg.status === "executing") return "This leg is still executing";
  if (legs.some((l) => l.index < index && !done(l.status))) return "Earlier legs must finish first";
  return null;
}

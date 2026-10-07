import { formatIndicator } from "@/lib/indicators/compute";

import type { EvaluationWarning } from "./evaluate";

const FALLBACK_TEXT: Record<EvaluationWarning["fallback"], string> = {
  else: "the condition took its else branch",
  ranked_last: "the filter ranked it last",
  equal_weight: "the group fell back to equal weights",
};

/** One sentence for the UI, e.g. "JTO has 12 days of price history but Cumulative return(30) needs 31, so the filter ranked it last." */
export function describeWarning(
  warning: EvaluationWarning,
  symbolOf: (mint: string) => string,
): string {
  const symbol = symbolOf(warning.mint);
  const indicator = formatIndicator(warning.indicator);
  const have =
    warning.barsAvailable === 0
      ? `${symbol} has no price history yet`
      : `${symbol} has ${warning.barsAvailable} ${warning.barsAvailable === 1 ? "day" : "days"} of price history`;
  return `${have} but ${indicator} needs ${warning.barsNeeded}, so ${FALLBACK_TEXT[warning.fallback]}.`;
}

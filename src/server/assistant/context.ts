import "server-only";

import { CONTEXT_TAG } from "@/lib/agent/transcript";
import { registryLookup } from "@/lib/assets/symphony-tools";
import type { AgentContext } from "@/lib/assistant/schemas";
import { describeRule } from "@/lib/invest/schedule";
import { toTickerTree } from "@/lib/symphony/ticker-tree";
import { getOwnedInvestment, ruleOf, symphonyOf } from "@/server/invest/service";

/**
 * The context block an "Ask AI" panel adds before the user's message: the
 * symphony they're looking at, as a ticker tree (no mints). Investments must
 * belong to the wallet (404 otherwise).
 */
export async function buildContext(context: AgentContext, wallet: string): Promise<string> {
  const { symbolOf } = await registryLookup();
  if (context.kind === "editor") {
    const tree = toTickerTree(context.symphony, symbolOf);
    return `${CONTEXT_TAG}
The user is asking from the symphony editor about this draft. It isn't invested; nothing changes unless they accept a suggestion.
${JSON.stringify(tree)}
To suggest changes, call createSymphony with the complete modified symphony (shown to them as a diff against this one). To compare performance, call runBacktest with each tree over the same period.
</orchestra-context>`;
  }
  const investment = await getOwnedInvestment(context.investmentId, wallet);
  const tree = toTickerTree(symphonyOf(investment), symbolOf);
  return `${CONTEXT_TAG}
The user is asking from the page of their live investment "${investment.name}" (symphonyId ${investment.id}; ${describeRule(ruleOf(investment))}; status ${investment.status}).
${JSON.stringify(tree)}
Use runBacktest and explainRebalance with this symphonyId. To suggest changes, call createSymphony with the complete modified symphony: they see a diff, and if they accept, the live strategy changes from its next rebalance (every trade still needs their wallet signature).
</orchestra-context>`;
}

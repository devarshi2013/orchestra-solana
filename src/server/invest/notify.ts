import "server-only";

import { serverEnv } from "@/env/server";
import { formatUsd } from "@/lib/backtest/format";
import { nextDueAt } from "@/lib/invest/schedule";
import { db } from "@/server/db";
import { sendEmail } from "@/server/notify/email";
import { pushToOwner } from "@/server/notify/push";

import { maxDriftPct, ruleOf, snapshot, type Snapshot } from "./service";

type InvestmentRow = Awaited<ReturnType<typeof db.investment.findUniqueOrThrow>>;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Tells the owner a rebalance is due: an in-app notice (the banner), plus an
 * email and web push when configured. Skipped while an earlier notice for
 * this investment is still unread, so nobody gets a daily pile-up.
 */
export async function notifyRebalanceDue(
  investment: InvestmentRow,
  snap: Snapshot,
): Promise<boolean> {
  const unread = await db.notification.findFirst({
    where: { investmentId: investment.id, kind: "rebalance_due", readAt: null },
  });
  if (unread) return false;

  const url = `${serverEnv.APP_URL}/invest/${investment.id}/rebalance`;
  const traded = snap.plan.legs.reduce((sum, leg) => sum + leg.usd, 0);
  const title = `Rebalance due: ${investment.name}`;
  const body = `${snap.plan.legs.length} ${snap.plan.legs.length === 1 ? "trade" : "trades"} (about ${formatUsd(traded)}) to bring it back to target. Review and sign in your wallet.`;
  const notification = await db.notification.create({
    data: {
      owner: investment.owner,
      investmentId: investment.id,
      kind: "rebalance_due",
      title,
      body,
      url,
    },
  });

  if (investment.notifyEmail) {
    try {
      const sent = await sendEmail({
        to: investment.notifyEmail,
        subject: title,
        text: `${body}\n\nReview & rebalance: ${url}\n\nNothing is traded until you sign each swap in your wallet.`,
        html: `<p>${escapeHtml(body)}</p><p><a href="${url}">Review &amp; rebalance</a></p><p style="color:#666">Nothing is traded until you sign each swap in your wallet.</p>`,
      });
      if (sent)
        await db.notification.update({
          where: { id: notification.id },
          data: { emailedAt: new Date() },
        });
    } catch (error) {
      console.error("[notify] email failed", error);
    }
  }
  try {
    if ((await pushToOwner(investment.owner, { title, body, url })) > 0) {
      await db.notification.update({
        where: { id: notification.id },
        data: { pushedAt: new Date() },
      });
    }
  } catch (error) {
    console.error("[notify] push failed", error);
  }
  return true;
}

export type DueReport = {
  checked: number;
  notified: string[];
  errors: { id: string; error: string }[];
  deferred: number;
};

/**
 * The daily check behind /api/cron/rebalances. For each active investment
 * whose check is due: calendar rules notify when the plan has trades;
 * threshold rules only when a holding drifted past the rule's threshold.
 * Either way the next check is scheduled.
 */
export async function checkDueInvestments(now: Date, outOfTime: () => boolean): Promise<DueReport> {
  const due = await db.investment.findMany({
    where: { status: "active", nextDueAt: { lte: now } },
    orderBy: { nextDueAt: "asc" },
  });
  const report: DueReport = { checked: 0, notified: [], errors: [], deferred: 0 };
  for (const investment of due) {
    if (outOfTime()) {
      report.deferred++;
      continue;
    }
    report.checked++;
    const rule = ruleOf(investment);
    try {
      const snap = await snapshot(investment);
      const needed =
        snap.plan.legs.length > 0 &&
        (rule.kind !== "threshold" || maxDriftPct(snap.plan) > rule.driftPct);
      if (needed && (await notifyRebalanceDue(investment, snap)))
        report.notified.push(investment.id);
    } catch (error) {
      report.errors.push({
        id: investment.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await db.investment.update({
      where: { id: investment.id },
      data: { nextDueAt: nextDueAt(rule, now) },
    });
  }
  return report;
}

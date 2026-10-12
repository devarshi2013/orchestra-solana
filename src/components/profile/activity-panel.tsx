"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { SoftButton } from "@/components/assistant/controls";
import { formatPrice } from "@/components/market/format";
import { solscanTxUrl } from "@/lib/solana";
import type { Fill, Notification } from "@/lib/strategies/types";
import { cn } from "@/lib/utils";

import { dateTime, qty, usd } from "./format";
import type { ActivityDay } from "./summary";

const WEEKS = 26;
const LEVELS = ["bg-soft", "bg-gray-1400/20", "bg-gray-1400/40", "bg-gray-1400/65", "bg-gray-1400"];
const HEAD = "pb-2.5 text-[12.5px] font-medium text-ink-muted";

/** Trades by day, then the trade list and notifications. */
export function ActivityPanel({
  activity,
  complete,
  fills,
  notifications,
  onMarkRead,
}: {
  activity: ActivityDay[];
  /** Whether `activity` covers every recorded trade (else only the latest ones). */
  complete: boolean;
  fills: Fill[];
  notifications: Notification[];
  onMarkRead: () => Promise<void>;
}) {
  return (
    <div className="space-y-10">
      <Heatmap
        activity={activity}
        since={complete ? null : (fills.at(-1)?.blockTime.slice(0, 10) ?? null)}
      />
      <section>
        <h3 className="pb-3 text-[15px] font-semibold tracking-[-0.01em] text-text-extra-high">
          Trades
        </h3>
        {fills.length === 0 ? (
          <p className="py-8 text-center text-[13.5px] text-ink-muted">No trades yet</p>
        ) : (
          <Trades fills={fills} />
        )}
      </section>
      <Notifications notifications={notifications} onMarkRead={onMarkRead} />
    </div>
  );
}

/**
 * The last 26 weeks as a GitHub-style grid: one cell per day, darker for more
 * trades. Days before `since` (older than the listed trades) are unknown, not empty.
 */
function Heatmap({ activity, since }: { activity: ActivityDay[]; since: string | null }) {
  const [hover, setHover] = useState<{ date: string; day: ActivityDay | null } | null>(null);
  const { weeks, max, total } = useMemo(() => {
    const byDate = new Map(activity.map((d) => [d.date, d]));
    const today = new Date();
    const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    // Columns are weeks ending this week; rows Sunday → Saturday.
    const start = end - ((WEEKS - 1) * 7 + new Date(end).getUTCDay()) * 86_400_000;
    const grid = Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const time = start + (w * 7 + d) * 86_400_000;
        const date = new Date(time).toISOString().slice(0, 10);
        return {
          date,
          future: time > end,
          unknown: since != null && date < since,
          day: byDate.get(date) ?? null,
        };
      }),
    );
    return {
      weeks: grid,
      max: Math.max(1, ...activity.map((d) => d.trades)),
      total: activity.reduce((sum, d) => sum + d.trades, 0),
    };
  }, [activity, since]);
  const level = (trades: number) => (trades === 0 ? 0 : Math.min(4, Math.ceil((trades / max) * 4)));

  return (
    <section>
      <div className="flex items-baseline justify-between pb-3">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-text-extra-high">
          Activity
        </h3>
        <p className="text-[12.5px] text-ink-muted tabular-nums">
          {hover
            ? `${new Date(`${hover.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${hover.day ? `${hover.day.trades} trade${hover.day.trades === 1 ? "" : "s"}, ${usd(hover.day.volume)}` : "No trades"}`
            : `${total} trade${total === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="overflow-x-auto rounded-[20px] bg-white p-4 shadow-hairline">
        <div
          className="grid min-w-[480px] justify-between gap-y-[3px]"
          style={{ gridTemplateColumns: `repeat(${WEEKS}, 14px)` }}
          onMouseLeave={() => setHover(null)}
        >
          {weeks.map((week, w) => (
            <div key={w} className="grid gap-[3px]">
              {week.map((cell) => (
                <span
                  key={cell.date}
                  onMouseEnter={() => !cell.future && !cell.unknown && setHover(cell)}
                  className={cn(
                    "size-3.5 rounded-[3px]",
                    cell.future
                      ? "bg-transparent"
                      : cell.unknown
                        ? "border border-dashed border-border-light"
                        : LEVELS[level(cell.day?.trades ?? 0)],
                  )}
                  aria-label={
                    cell.future || cell.unknown
                      ? undefined
                      : `${cell.date}: ${cell.day?.trades ?? 0} trades`
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trades({ fills }: { fills: Fill[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[14px] tracking-[-0.01em] tabular-nums">
        <thead>
          <tr className="text-left">
            <th className={HEAD}>Date</th>
            <th className={HEAD}>Token</th>
            <th className={HEAD}>Side</th>
            <th className={cn(HEAD, "text-right")}>Amount</th>
            <th className={cn(HEAD, "text-right")}>Price</th>
            <th className={HEAD} aria-label="Transaction" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-extra-light border-t border-border-light">
          {fills.map((f) => (
            <tr key={f.signature} className="h-14">
              <td className="text-text-high">{dateTime(f.blockTime)}</td>
              <td className="font-semibold text-text-extra-high">{f.symbol}</td>
              <td
                className={cn("capitalize", f.side === "buy" ? "text-emerald-700" : "text-red-700")}
              >
                {f.side}
              </td>
              <td className="text-right">
                <span className="block text-text-extra-high">{usd(f.usdcAmount)}</span>
                <span className="block text-[12px] text-ink-muted">
                  {qty(f.tokenAmount)} {f.symbol}
                </span>
              </td>
              <td className="text-right text-text-high">{formatPrice(f.price)}</td>
              <td className="pl-3 text-right">
                <a
                  href={solscanTxUrl(f.signature, "mainnet-beta")}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View on Solscan"
                  className="inline-flex text-ink-muted hover:text-text-extra-high"
                >
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Notifications({
  notifications,
  onMarkRead,
}: {
  notifications: Notification[];
  onMarkRead: () => Promise<void>;
}) {
  const unread = notifications.filter((n) => !n.readAt).length;
  return (
    <section>
      <div className="flex items-center justify-between pb-3">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-text-extra-high">
          Notifications
        </h3>
        {unread > 0 && <SoftButton onClick={() => void onMarkRead()}>Mark all read</SoftButton>}
      </div>
      {notifications.length === 0 ? (
        <p className="py-8 text-center text-[13.5px] text-ink-muted">No notifications</p>
      ) : (
        <ul className="divide-y divide-border-extra-light border-t border-border-light">
          {notifications.map((n) => (
            <li key={n.id} className="flex items-start gap-3 py-3">
              <span
                aria-label={n.readAt ? undefined : "Unread"}
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  n.readAt ? "bg-transparent" : "bg-gray-1400",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-text-extra-high">
                  {n.title}
                </span>
                <span className="block text-[13px] text-ink-muted">{n.body}</span>
              </span>
              <span className="shrink-0 text-[12.5px] text-ink-muted tabular-nums">
                {dateTime(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

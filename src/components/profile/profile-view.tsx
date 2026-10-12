"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";

import { IconButton } from "@/components/assistant/controls";
import { Change } from "@/components/market/change";
import { RollText } from "@/components/motion";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { LivePrices } from "@/hooks/use-live-prices";
import type { HistoryState } from "@/hooks/use-profile";
import { usePersistentFlag } from "@/hooks/use-persistent-flag";
import type { ProfileResponse, StrategyStatus } from "@/lib/strategies/types";
import { cn } from "@/lib/utils";

import { ActivityPanel } from "./activity-panel";
import { HIDDEN, signedUsd, tone, usd } from "./format";
import { PerformanceChart } from "./performance-chart";
import { PositionSheet } from "./position-sheet";
import { PositionsTable } from "./positions-table";
import { SettingsPanel } from "./settings-panel";
import { StrategiesPanel } from "./strategies-panel";
import { summarize, tradeStats } from "./summary";

/** What the view can do; the page wires these to the API (the dev preview to no-ops). */
export type ProfileActions = {
  reload: () => void;
  /** Cancel, or re-arm (back to watching). */
  setStatus: (
    id: string,
    status: Extract<StrategyStatus, "cancelled" | "watching">,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setWebhook: (url: string | null) => Promise<void>;
  markRead: () => Promise<void>;
};

type Tab = "positions" | "strategies" | "activity" | "settings";

/** The signed-in portfolio: value and P&L, performance, stats, then tabs. */
export function ProfileView({
  profile,
  prices,
  error,
  actions,
  share,
  history,
}: {
  profile: ProfileResponse;
  prices: LivePrices;
  /** The latest profile read's error (the data shown is from an earlier read). */
  error: string | null;
  actions: ProfileActions;
  /** The share button, placed by the page. */
  share?: ReactNode;
  /** Dev preview only: sample chart history. */
  history?: HistoryState;
}) {
  const [hidden, setHidden] = usePersistentFlag("tickertape.hide-balances.v1");
  const [tab, setTab] = useState<Tab>("positions");
  const [open, setOpen] = useState<string | null>(null);
  const summary = summarize(profile, prices.prices);
  const trades = tradeStats(profile.fills);
  const triggered = profile.strategies.filter((s) => s.status === "triggered").length;
  const unread = profile.notifications.filter((n) => !n.readAt).length;
  const icons = Object.fromEntries(profile.positions.map((p) => [p.mint, p.icon]));
  const mask = (text: string) => (hidden ? HIDDEN : text);

  const tabs = [
    { value: "positions", label: <TabLabel count={summary.rows.length}>Positions</TabLabel> },
    {
      value: "strategies",
      label: (
        <TabLabel count={profile.strategies.length} dot={triggered > 0}>
          Strategies
        </TabLabel>
      ),
    },
    { value: "activity", label: <TabLabel dot={unread > 0}>Activity</TabLabel> },
    { value: "settings", label: <TabLabel>Settings</TabLabel> },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <WalletChip wallet={profile.wallet} />
        <IconButton
          aria-label={hidden ? "Show balances" : "Hide balances"}
          aria-pressed={hidden}
          onClick={() => setHidden(!hidden)}
        >
          {hidden ? <EyeOff /> : <Eye />}
        </IconButton>
        <div className="ml-auto">{share}</div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="flex flex-col justify-between rounded-[24px] bg-white p-6 shadow-hairline">
          <div>
            <p className="text-[13px] text-ink-muted">Portfolio value</p>
            <Amount value={summary.total} hidden={hidden} />
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              {summary.pnl == null ? (
                <span className="text-[14px] text-ink-muted">No recorded buys</span>
              ) : (
                <>
                  <span className={cn("text-[16px] font-semibold tabular-nums", tone(summary.pnl))}>
                    {mask(signedUsd(summary.pnl))}
                  </span>
                  <Change pct={summary.pnlPct} tone="accent" className="text-[14px] font-medium" />
                  <span className="text-[13px] text-ink-muted">unrealized</span>
                </>
              )}
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[16px] bg-border-extra-light">
            <Cell label="Stocks">{mask(summary.stocks == null ? "—" : usd(summary.stocks))}</Cell>
            <Cell label="USDC">{mask(usd(profile.usdcBalance))}</Cell>
          </dl>
          {(prices.stale || error) && (
            <p className="mt-3 text-[12.5px] tabular-nums">
              {prices.stale && prices.asOf && (
                <span className="text-status-warning-text">
                  Prices from {new Date(prices.asOf).toLocaleTimeString("en-US")}
                </span>
              )}
              {error && <span className="ml-2 text-status-error-text">{error}</span>}
            </p>
          )}
        </section>
        <PerformanceChart hidden={hidden} sample={history} />
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-[24px] bg-white shadow-hairline sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Invested">{summary.invested == null ? "—" : mask(usd(summary.invested))}</Stat>
        <Stat label="Unrealized" className={tone(summary.pnl)}>
          {summary.pnl == null ? "—" : mask(signedUsd(summary.pnl))}
        </Stat>
        <Stat label="24h" className={tone(summary.day)}>
          {summary.day == null ? (
            "—"
          ) : (
            <span className="flex items-baseline gap-1.5">
              {mask(signedUsd(summary.day))}
              <Change pct={summary.dayPct} tone="accent" className="text-[13px] font-medium" />
            </span>
          )}
        </Stat>
        <Stat label="Realized" className={tone(trades.realized)}>
          {trades.realized == null ? "—" : mask(signedUsd(trades.realized))}
        </Stat>
        <Stat label="Trades">
          {trades.complete ? trades.trades : `${trades.trades}+`}
          {trades.trades > 0 && (
            <span className="ml-1.5 text-[13px] font-normal text-ink-muted">
              {trades.buys}B · {trades.sells}S
            </span>
          )}
        </Stat>
        <Stat label="Best">
          {summary.best ? (
            <span className="flex items-baseline gap-1.5">
              {summary.best.symbol}
              <Change pct={summary.best.pnlPct} tone="accent" className="text-[13px]" />
            </span>
          ) : (
            "—"
          )}
        </Stat>
      </dl>

      <div className="pt-2">
        <SegmentedControl
          aria-label="Section"
          items={tabs}
          value={tab}
          onValueChange={setTab}
          className="max-w-full overflow-x-auto"
        />
      </div>

      <div className="min-h-64">
        {tab === "positions" && (
          <PositionsTable
            rows={summary.rows}
            stale={prices.stale}
            hidden={hidden}
            onOpen={setOpen}
          />
        )}
        {tab === "strategies" && (
          <StrategiesPanel
            strategies={profile.strategies}
            prices={prices}
            icons={icons}
            actions={actions}
          />
        )}
        {tab === "activity" && (
          <ActivityPanel
            activity={trades.activity}
            complete={trades.complete}
            fills={profile.fills}
            notifications={profile.notifications}
            onMarkRead={actions.markRead}
          />
        )}
        {tab === "settings" && (
          <SettingsPanel url={profile.webhookUrl} onSave={actions.setWebhook} />
        )}
      </div>

      <PositionSheet
        position={summary.rows.find((r) => r.mint === open) ?? null}
        fills={profile.fills}
        hidden={hidden}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function TabLabel({
  children,
  count,
  dot,
}: {
  children: ReactNode;
  count?: number;
  dot?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {count != null && count > 0 && (
        <span className="text-[12px] text-ink-muted tabular-nums">{count}</span>
      )}
      {dot && <span className="size-1.5 rounded-full bg-amber-500" aria-label="New" />}
    </span>
  );
}

/** metengine's big number: whole dollars bold, cents light. */
function Amount({ value, hidden }: { value: number | null; hidden: boolean }) {
  const text = value == null ? "—" : hidden ? HIDDEN : usd(value);
  const [whole, cents] = text.split(".");
  return (
    <p className="mt-1 text-[44px] leading-[1.05] tracking-[-0.03em] text-text-extra-high tabular-nums">
      <span className="font-semibold">
        <RollText value={whole!} />
      </span>
      {cents != null && <span className="font-light text-text-medium">.{cents}</span>}
    </p>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-soft px-4 py-3">
      <dt className="text-[12px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-medium text-text-extra-high tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function Stat({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border-extra-light px-5 py-4 max-lg:border-t lg:[&:not(:first-child)]:border-l sm:max-lg:[&:not(:nth-child(3n+1))]:border-l max-sm:[&:nth-child(-n+2)]:border-t-0 sm:max-lg:[&:nth-child(-n+3)]:border-t-0 max-sm:[&:nth-child(even)]:border-l">
      <dt className="text-[12.5px] text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-[19px] font-semibold tracking-[-0.01em] text-text-extra-high tabular-nums",
          className,
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** The wallet, shortened; click copies it. */
function WalletChip({ wallet }: { wallet: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard.writeText(wallet).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy wallet address"
      className="group inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-soft px-3.5 font-mono text-[12.5px] text-text-high transition-colors hover:bg-white hover:shadow-hairline"
    >
      {wallet.slice(0, 4)}…{wallet.slice(-4)}
      {copied ? (
        <Check className="size-3.5 text-emerald-700" aria-hidden />
      ) : (
        <Copy className="size-3.5 text-ink-muted opacity-0 group-hover:opacity-100" aria-hidden />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { IconButton, SoftButton } from "@/components/assistant/controls";
import { ConditionVisual } from "@/components/assistant/strategy-card";
import { formatDate } from "@/components/market/format";
import { TokenLogo } from "@/components/market/token-logo";
import { CardReveal } from "@/components/motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStock } from "@/hooks/use-markets";
import type { LivePrices } from "@/hooks/use-live-prices";
import type { Condition, Strategy, StrategyStatus } from "@/lib/strategies/types";
import { cn } from "@/lib/utils";

import { describeStrategy, describeTrigger } from "./condition";
import { dateTime, usd } from "./format";
import type { ProfileActions } from "./profile-view";
import { StrategyBuy } from "./strategy-buy";
import { StrategyForm } from "./strategy-form";

const WHEN: { [T in Condition["type"]]: (c: Extract<Condition, { type: T }>) => string } = {
  price_below: (c) => `when it drops below ${usd(c.price)}`,
  price_above: (c) => `when it rises above ${usd(c.price)}`,
  change_below: (c) => `when it falls ${Math.abs(c.pct)}% in 24h`,
  change_above: (c) => `when it rises ${c.pct}% in 24h`,
  every: (c) => (c.days === 1 ? "every day" : `every ${c.days} days`),
};
const when = (c: Condition) => (WHEN[c.type] as (c: Condition) => string)(c);

const STATUS: Record<StrategyStatus, { label: string; className: string; live?: boolean }> = {
  watching: {
    label: "Watching",
    className: "bg-status-success-bg text-status-success-text",
    live: true,
  },
  triggered: { label: "Triggered", className: "bg-amber-50 text-amber-800" },
  filled: { label: "Bought", className: "bg-soft text-text-high" },
  cancelled: { label: "Cancelled", className: "bg-soft text-ink-muted" },
};

/** Strategies as tickets (the chat card's language), triggered ones first. */
export function StrategiesPanel({
  strategies,
  prices,
  icons,
  actions,
}: {
  strategies: Strategy[];
  prices: LivePrices;
  icons: Record<string, string | null>;
  actions: ProfileActions;
}) {
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const order: StrategyStatus[] = ["triggered", "watching", "filled", "cancelled"];
  const sorted = [...strategies].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const act = (run: () => Promise<void>) =>
    void run()
      .then(() => {
        setFailed(null);
        actions.reload();
      })
      .catch((e: unknown) => setFailed(e instanceof Error ? e.message : "Couldn't update"));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {failed ? <p className="text-[12.5px] text-status-error-text">{failed}</p> : <span />}
        {!creating && (
          <SoftButton onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> New strategy
          </SoftButton>
        )}
      </div>
      {creating && (
        <CardReveal className="rounded-[24px] bg-white p-5 shadow-hairline">
          <StrategyForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              actions.reload();
            }}
          />
        </CardReveal>
      )}
      {sorted.length === 0 && !creating ? (
        <p className="py-14 text-center text-[13.5px] text-ink-muted">No strategies</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {sorted.map((s) => (
            <Ticket
              key={s.id}
              strategy={s}
              icon={icons[s.mint] ?? null}
              price={prices.prices[s.mint] ?? null}
              onAct={act}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Ticket({
  strategy: s,
  icon,
  price,
  actions,
  onAct,
}: {
  strategy: Strategy;
  icon: string | null;
  price: { price: number; change24h: number | null } | null;
  actions: ProfileActions;
  onAct: (run: () => Promise<void>) => void;
}) {
  const [buying, setBuying] = useState(false);
  const status = STATUS[s.status];
  const trigger = describeTrigger(s);
  const done = s.status === "filled" || s.status === "cancelled";

  return (
    <li
      id={`strategy-${s.id}`}
      className={cn(
        "flex scroll-mt-28 flex-col rounded-[24px] bg-white p-5 shadow-hairline target:ring-2 target:ring-gray-1400/15",
        done && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3">
        <TokenLogo src={icon} symbol={s.symbol} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-text-extra-high">
            {s.symbol}
          </p>
          <p className="truncate text-[12.5px] text-ink-muted">{s.name}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
            status.className,
          )}
        >
          {status.live && (
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex size-full rounded-full bg-status-success-text opacity-50 motion-safe:animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-status-success-text" />
            </span>
          )}
          {status.label}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label={`Actions for ${describeStrategy(s)}`}>
              <MoreHorizontal />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {done ? (
              <DropdownMenuItem onSelect={() => onAct(() => actions.setStatus(s.id, "watching"))}>
                Re-arm
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onAct(() => actions.setStatus(s.id, "cancelled"))}>
                Cancel
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onAct(() => actions.remove(s.id))}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="mt-4 text-[30px] leading-none font-semibold tracking-[-0.02em] text-text-extra-high tabular-nums">
        {usd(s.usdcAmount)}
      </p>
      <p className="mt-1.5 text-[13.5px] text-ink-muted">
        of {s.symbol} {when(s.condition)}
        {s.repeat && ", repeating"}
      </p>

      {!done && (
        <div className="mt-4">
          <ConditionVisual
            condition={s.condition}
            price={price?.price ?? null}
            change={price?.change24h ?? null}
          />
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="text-[12.5px] text-ink-muted tabular-nums">
          {s.triggeredAt
            ? `Triggered ${dateTime(s.triggeredAt)}${trigger ? ` ${trigger}` : ""}`
            : `Created ${formatDate(s.createdAt)}`}
        </p>
        {s.status === "triggered" && !buying && (
          <SoftButton dark onClick={() => setBuying(true)}>
            Buy now
          </SoftButton>
        )}
      </div>
      {buying && (
        <BuyLoader
          strategy={s}
          onClose={() => setBuying(false)}
          onFilled={() => {
            setBuying(false);
            actions.reload();
          }}
        />
      )}
    </li>
  );
}

/** The strategy's token decimals come from the live stock universe before the buy card opens. */
function BuyLoader(props: { strategy: Strategy; onClose: () => void; onFilled: () => void }) {
  const stock = useStock(props.strategy.symbol);
  const token = stock.data?.stock.tokens.find((t) => t.mint === props.strategy.mint);
  if (token) return <StrategyBuy {...props} decimals={token.decimals} />;
  return (
    <p className="mt-2 text-[12.5px] text-ink-muted">
      {stock.error ?? (stock.data ? `${props.strategy.symbol} is no longer listed` : "Loading…")}
    </p>
  );
}

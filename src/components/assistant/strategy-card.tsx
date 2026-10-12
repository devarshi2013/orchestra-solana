"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, BellRing, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { Switch } from "radix-ui";
import { useId, useState, type ReactNode } from "react";

import { HoldToConfirm } from "@/components/arc/hold-to-confirm";
import { motionTokens } from "@/components/arc/motion-tokens";
import { SlotText } from "@/components/arc/slot-text";
import { TokenLogo } from "@/components/market/token-logo";
import { issuerLabel } from "@/components/market/stock-figures";
import { CardReveal, RevealRow } from "@/components/motion";
import { useStock } from "@/hooks/use-markets";
import { useSession } from "@/hooks/use-session";
import { useTokenPrice } from "@/hooks/use-token-price";
import { strategiesApi } from "@/lib/api-client";
import type { StrategyProposal } from "@/lib/assistant/views";
import { formatUsd } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";
import { newStrategySchema, type Condition } from "@/lib/strategies/types";
import { MIN_ORDER_USD } from "@/lib/units";
import { cn } from "@/lib/utils";

type Draft = Pick<StrategyProposal, "usdcAmount" | "condition" | "repeat">;
type Busy = "signing-in" | "creating" | null;

const BUSY_LABEL: Record<NonNullable<Busy>, string> = {
  "signing-in": "Sign in with your wallet…",
  creating: "Creating…",
};

const pct = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
const shortDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The condition as a clause after "of NVDAx": "when it drops below $200.00". */
function whenText(condition: Condition): string {
  switch (condition.type) {
    case "price_below":
      return `when it drops below ${formatUsd(condition.price)}`;
    case "price_above":
      return `when it rises above ${formatUsd(condition.price)}`;
    case "change_below":
      return `when it falls ${Math.abs(condition.pct)}% in 24h`;
    case "change_above":
      return `when it gains ${condition.pct}% in 24h`;
    case "every":
      return condition.days === 1 ? "every day" : `every ${condition.days} days`;
  }
}

/** Already met at the current price or change: it would trigger on the next check. */
function alreadyMet(condition: Condition, price: number | null, change: number | null) {
  switch (condition.type) {
    case "price_below":
      return price !== null && price <= condition.price;
    case "price_above":
      return price !== null && price >= condition.price;
    case "change_below":
      return change !== null && change <= condition.pct;
    case "change_above":
      return change !== null && change >= condition.pct;
    case "every":
      return false;
  }
}

/**
 * A conditional buy the assistant proposed, as a ticket: the token, the amount,
 * a live picture of how far the trigger is, and (before it exists) quick edits
 * and a hold-to-create button. Nothing is created until the user holds it,
 * signing in with their wallet first; then the server watches it.
 */
export function StrategyCard({
  strategy,
  createdId,
  onCreated,
}: {
  strategy: StrategyProposal;
  /** Set once created (kept with the chat, so a reopened chat shows it). */
  createdId?: string;
  onCreated: (id: string) => void;
}) {
  const session = useSession();
  const [draft, setDraft] = useState<Draft>({
    usdcAmount: strategy.usdcAmount,
    condition: strategy.condition,
    repeat: strategy.repeat,
  });
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const created = Boolean(createdId);

  const live = useTokenPrice(strategy.mint);
  const { quote } = live;
  const price = quote?.price ?? strategy.currentPrice;
  const change = quote?.change24h ?? null;
  const token = useStock(strategy.symbol).data?.stock.tokens.find(
    (t) => t.symbol === strategy.symbol,
  );

  const valid = newStrategySchema.safeParse({ symbol: strategy.symbol, ...draft });
  const met = !created && alreadyMet(draft.condition, price, change);
  const problem = !valid.success
    ? (valid.error.issues[0]?.message ?? "Check the amounts")
    : met
      ? "Already met: it would trigger on the next check"
      : null;

  const create = async () => {
    setError(null);
    try {
      // Signing in connects the wallet first when none is connected.
      if (!session.wallet) {
        setBusy("signing-in");
        await session.signIn();
      }
      setBusy("creating");
      const strategyRow = await strategiesApi.create({ symbol: strategy.symbol, ...draft });
      onCreated(strategyRow.id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <CardReveal className="overflow-hidden rounded-[24px] bg-white tracking-[-0.01em] shadow-[0_0_0_1px_rgba(17,17,17,0.06),0_1px_2px_rgba(17,17,17,0.04),0_12px_32px_-12px_rgba(17,17,17,0.14)]">
      <section aria-label={`Strategy: buy ${strategy.symbol}`} className="p-5 sm:p-6">
        <RevealRow className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <TokenLogo src={token?.icon} symbol={strategy.symbol} className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-text-extra-high">
                {strategy.symbol}
              </p>
              <p className="truncate text-[12.5px] text-ink-muted">
                {strategy.name}
                {token ? ` · ${issuerLabel(token.issuer)}` : ""}
              </p>
            </div>
          </div>
          <StatusChip watching={created} />
        </RevealRow>

        <RevealRow className="mt-6">
          <p className="text-[40px] leading-none font-semibold tracking-[-0.03em] text-text-extra-high tabular-nums sm:text-[44px]">
            <SlotText value={formatUsd(draft.usdcAmount)} spins={0} duration={0.6} stagger={0.04} />
          </p>
          <p className="mt-2 text-[14px] text-ink-muted">
            of {strategy.symbol} {whenText(draft.condition)}
            {draft.repeat ? ", repeating" : ""}
          </p>
        </RevealRow>

        <RevealRow className="mt-6">
          <ConditionVisual condition={draft.condition} price={price} change={change} />
          {live.stale && live.asOf && (
            <p className="mt-2 text-[12px] text-ink-muted">
              Price not updated since {new Date(live.asOf).toLocaleTimeString("en-US")}
            </p>
          )}
        </RevealRow>

        {!created && (
          <RevealRow className="mt-6 grid grid-cols-1 gap-3 rounded-[18px] bg-soft p-3 sm:grid-cols-[1fr_1fr_auto]">
            <Stepper
              label="Amount"
              value={draft.usdcAmount}
              step={10}
              min={MIN_ORDER_USD}
              format={(v) => formatUsd(v)}
              onChange={(usdcAmount) => setDraft((d) => ({ ...d, usdcAmount }))}
            />
            <ConditionStepper
              condition={draft.condition}
              price={price}
              onChange={(condition) => setDraft((d) => ({ ...d, condition }))}
            />
            <RepeatSwitch
              checked={draft.repeat}
              onChange={(repeat) => setDraft((d) => ({ ...d, repeat }))}
            />
          </RevealRow>
        )}

        <RevealRow className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p
            role={error ? "alert" : undefined}
            className={cn(
              "min-w-0 text-[13px]",
              error ? "text-status-error-text" : "text-ink-muted",
            )}
          >
            {error ?? (created ? "" : problem)}
          </p>
          {created ? (
            <Link
              href="/portfolio"
              className="group inline-flex items-center gap-1 text-[13.5px] font-medium text-text-extra-high"
            >
              View in portfolio
              <ArrowUpRight className="size-4 text-ink-muted transition-transform duration-150 group-hover:translate-x-px group-hover:-translate-y-px group-hover:text-text-extra-high" />
            </Link>
          ) : (
            <HoldToConfirm
              tone="neutral"
              icon={<BellRing strokeWidth={1.75} />}
              label={busy ? BUSY_LABEL[busy] : "Hold to create"}
              confirmedLabel="Watching"
              confirmed={created}
              disabled={busy !== null || problem !== null}
              onConfirm={() => void create()}
            />
          )}
        </RevealRow>
      </section>
    </CardReveal>
  );
}

function StatusChip({ watching }: { watching: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
        watching ? "bg-status-success-bg text-status-success-text" : "bg-soft text-text-medium",
      )}
    >
      {watching && (
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-status-success-text opacity-50 motion-safe:animate-ping" />
          <span className="relative inline-flex size-1.5 rounded-full bg-status-success-text" />
        </span>
      )}
      {watching ? "Watching" : "Draft"}
    </span>
  );
}

export function ConditionVisual({
  condition,
  price,
  change,
}: {
  condition: Condition;
  price: number | null;
  change: number | null;
}) {
  switch (condition.type) {
    case "price_below":
    case "price_above":
      return (
        <PriceTrack
          target={condition.price}
          price={price}
          below={condition.type === "price_below"}
        />
      );
    case "change_below":
    case "change_above":
      return <ChangeGauge threshold={condition.pct} change={change} />;
    case "every":
      return <Cadence days={condition.days} />;
  }
}

const spring = motionTokens.spring.smooth;

/** Current price and target on one track; the gap between them is how far the trigger is. */
function PriceTrack({
  target,
  price,
  below,
}: {
  target: number;
  price: number | null;
  below: boolean;
}) {
  const reduce = useReducedMotion();
  if (price === null) return <p className="text-[13px] text-ink-muted">Price unavailable</p>;
  const low = Math.min(price, target);
  const high = Math.max(price, target);
  const pad = Math.max((high - low) * 0.35, high * 0.01);
  const at = (value: number) => ((value - (low - pad)) / (high - low + 2 * pad)) * 100;
  const distance = ((target - price) / price) * 100;
  const met = below ? price <= target : price >= target;
  const close = !met && Math.abs(distance) < 2;

  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px] text-ink-muted tabular-nums">
        <span>{below ? "Target" : "Now"}</span>
        <span>{below ? "Now" : "Target"}</span>
      </div>
      <div className="relative mt-2 h-8">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-soft-strong" />
        <motion.div
          className={cn(
            "absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full",
            met ? "bg-status-success-text" : "bg-text-extra-high",
          )}
          initial={false}
          animate={{
            left: `${Math.min(at(price), at(target))}%`,
            width: `${Math.abs(at(price) - at(target))}%`,
          }}
          transition={reduce ? { duration: 0 } : spring}
        />
        <Marker left={at(target)} reduce={reduce} kind="target" />
        <Marker left={at(price)} reduce={reduce} kind="now" />
      </div>
      <div className="mt-1 flex items-baseline justify-between text-[13.5px] font-medium text-text-extra-high tabular-nums">
        <span>{formatUsd(below ? target : price)}</span>
        <span
          className={cn(
            "text-[12.5px] font-medium",
            met
              ? "text-status-success-text"
              : close
                ? "text-status-warning-text"
                : "text-ink-muted",
          )}
        >
          {met ? "Met: triggers on the next check" : `${pct(distance)} to trigger`}
        </span>
        <span>{formatUsd(below ? price : target)}</span>
      </div>
    </div>
  );
}

function Marker({
  left,
  reduce,
  kind,
}: {
  left: number;
  reduce: boolean | null;
  kind: "now" | "target";
}) {
  return (
    <motion.span
      aria-hidden
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      initial={false}
      animate={{ left: `${left}%` }}
      transition={reduce ? { duration: 0 } : spring}
    >
      {kind === "now" ? (
        <span className="block size-4 rounded-full border-[3px] border-white bg-text-extra-high shadow-[0_1px_4px_rgba(17,17,17,0.25)]" />
      ) : (
        <span className="block h-5 w-[3px] rounded-full bg-text-extra-high" />
      )}
    </motion.span>
  );
}

/** Today's 24h change against the trigger threshold, on a scale centred at zero. */
function ChangeGauge({ threshold, change }: { threshold: number; change: number | null }) {
  const reduce = useReducedMotion();
  const span = Math.max(Math.abs(threshold) * 1.5, Math.abs(change ?? 0) * 1.2, 5);
  const at = (value: number) => 50 + (Math.max(-span, Math.min(span, value)) / span) * 50;
  const met = change !== null && (threshold < 0 ? change <= threshold : change >= threshold);

  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px] text-ink-muted tabular-nums">
        <span>{pct(-span)}</span>
        <span>24h change</span>
        <span>{pct(span)}</span>
      </div>
      <div className="relative mt-2 h-8">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-soft-strong" />
        <span
          className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-black/20"
          aria-hidden
        />
        {change !== null && (
          <motion.div
            className={cn(
              "absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full",
              change >= 0 ? "bg-status-success-text" : "bg-status-error-text",
            )}
            initial={false}
            animate={{
              left: `${Math.min(50, at(change))}%`,
              width: `${Math.abs(at(change) - 50)}%`,
            }}
            transition={reduce ? { duration: 0 } : spring}
          />
        )}
        <Marker left={at(threshold)} reduce={reduce} kind="target" />
        {change !== null && <Marker left={at(change)} reduce={reduce} kind="now" />}
      </div>
      <div className="mt-1 flex items-baseline justify-between text-[12.5px] font-medium tabular-nums">
        <span className="text-text-extra-high">
          {change === null ? "Change unavailable" : `Now ${pct(change)}`}
        </span>
        <span className={met ? "text-status-success-text" : "text-ink-muted"}>
          {met ? "Met: triggers on the next check" : `Triggers at ${pct(threshold)}`}
        </span>
      </div>
    </div>
  );
}

/** A recurring buy: one dot per day of the cycle, the last one the buy day. */
function Cadence({ days }: { days: number }) {
  const [now] = useState(() => Date.now());
  const shown = Math.min(days, 14);
  return (
    <div>
      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full",
              i === shown - 1 ? "bg-text-extra-high" : "bg-soft-strong",
            )}
          />
        ))}
      </div>
      <p className="mt-2 flex justify-between text-[12.5px] tabular-nums">
        <span className="font-medium text-text-extra-high">
          {days === 1 ? "Every day" : `Every ${days} days`}
        </span>
        <span className="text-ink-muted">
          First buy {shortDate(new Date(now + days * 86_400_000))}
        </span>
      </p>
    </div>
  );
}

/** The editable number of the condition: target price, % change or cadence. */
function ConditionStepper({
  condition,
  price,
  onChange,
}: {
  condition: Condition;
  price: number | null;
  onChange: (condition: Condition) => void;
}) {
  switch (condition.type) {
    case "price_below":
    case "price_above": {
      const step = price ? Math.max(0.01, Number((price * 0.01).toPrecision(2))) : 1;
      return (
        <Stepper
          label="Target"
          value={condition.price}
          step={step}
          min={0.01}
          format={(v) => formatUsd(v)}
          onChange={(value) => onChange({ ...condition, price: Number(value.toFixed(2)) })}
        />
      );
    }
    case "change_below":
      return (
        <Stepper
          label="Drop"
          value={condition.pct}
          step={1}
          min={-100}
          max={-0.5}
          format={(v) => pct(v)}
          onChange={(value) => onChange({ ...condition, pct: value })}
        />
      );
    case "change_above":
      return (
        <Stepper
          label="Rise"
          value={condition.pct}
          step={1}
          min={0.5}
          max={1000}
          format={(v) => pct(v)}
          onChange={(value) => onChange({ ...condition, pct: value })}
        />
      );
    case "every":
      return (
        <Stepper
          label="Every"
          value={condition.days}
          step={1}
          min={1}
          max={365}
          format={(v) => (v === 1 ? "1 day" : `${v} days`)}
          onChange={(value) => onChange({ ...condition, days: Math.round(value) })}
        />
      );
  }
}

/** A pill number field with − and +, after Arc's number field; the value can also be typed. */
function Stepper({
  label,
  value,
  step,
  min,
  max = Number.MAX_SAFE_INTEGER,
  format,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max?: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const nudge = (dir: 1 | -1) => onChange(clamp(Number((value + dir * step).toFixed(6))));
  const commit = () => {
    if (text === null) return;
    const parsed = Number(text.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(parsed) && text.trim() !== "") onChange(clamp(parsed));
    setText(null);
  };

  return (
    <Field label={label} htmlFor={id}>
      <div className="flex h-10 items-center rounded-full bg-white px-1 shadow-[0_0_0_1px_rgba(17,17,17,0.08)]">
        <StepButton label={`Decrease ${label}`} disabled={value <= min} onClick={() => nudge(-1)}>
          <Minus />
        </StepButton>
        <input
          id={id}
          inputMode="decimal"
          value={text ?? format(value)}
          onFocus={() => setText(String(value))}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-full min-w-0 bg-transparent text-center text-[14px] font-medium text-text-extra-high tabular-nums outline-none"
        />
        <StepButton label={`Increase ${label}`} disabled={value >= max} onClick={() => nudge(1)}>
          <Plus />
        </StepButton>
      </div>
    </Field>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-soft hover:text-text-extra-high disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function RepeatSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <Field label="Repeat" htmlFor={id} inline>
      <div className="flex items-center sm:h-10 sm:justify-center">
        <Switch.Root
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          className="relative h-6 w-10 cursor-pointer rounded-full bg-black/15 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:ring-offset-2 data-[state=checked]:bg-text-extra-high"
        >
          <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(17,17,17,0.25)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform data-[state=checked]:translate-x-[18px] motion-reduce:transition-none" />
        </Switch.Root>
      </div>
    </Field>
  );
}

/** A small label over its control; `inline` puts them on one row on phones (a switch). */
function Field({
  label,
  htmlFor,
  inline = false,
  children,
}: {
  label: string;
  htmlFor: string;
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", inline && "flex items-center justify-between sm:block")}>
      <label
        htmlFor={htmlFor}
        className={cn(
          "block px-1 text-[12px] font-medium text-ink-muted",
          inline ? "sm:mb-1.5" : "mb-1.5",
        )}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

"use client";

import { Search, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import { IconButton, SoftButton } from "@/components/assistant/controls";
import { issuerLabel } from "@/components/market/stock-figures";
import { TokenLogo } from "@/components/market/token-logo";
import { RevealRow } from "@/components/motion";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useStockSearch } from "@/hooks/use-markets";
import { useSession } from "@/hooks/use-session";
import { ApiError, strategiesApi } from "@/lib/api-client";
import { friendlyError } from "@/lib/friendly-error";
import type { StockToken } from "@/lib/stocks/types";
import { newStrategySchema, type Strategy } from "@/lib/strategies/types";
import { MIN_ORDER_USD } from "@/lib/units";
import { cn } from "@/lib/utils";

import { CONDITION_KINDS, describeStrategy, toCondition, type ConditionKind } from "./condition";

/** The token a strategy buys: what the form shows for it. */
export type StrategyToken = Pick<StockToken, "symbol" | "icon" | "issuer"> & { name: string };

const KINDS = Object.entries(CONDITION_KINDS).map(([value, { label }]) => ({
  value: value as ConditionKind,
  label,
}));

const FIELD =
  "flex h-11 items-center rounded-[14px] bg-soft px-3.5 transition-[background-color,box-shadow] focus-within:bg-white focus-within:shadow-hairline";

/**
 * "Buy $X of a token when …": token (searched, or fixed when opened from a
 * stock page), USDC amount, condition and repeat. Saving needs the wallet
 * signed in; signed out, the button signs in first.
 */
export function StrategyForm({
  token: fixed,
  hideToken = false,
  onCreated,
  onCancel,
  className,
}: {
  token?: StrategyToken;
  /** The caller already shows (and picks) the token, e.g. the trade panel's dropdown. */
  hideToken?: boolean;
  onCreated: (strategy: Strategy) => void;
  onCancel?: () => void;
  className?: string;
}) {
  const session = useSession();
  const [picked, setPicked] = useState<StrategyToken | null>(null);
  const token = fixed ?? picked;
  const [amountText, setAmountText] = useState("");
  const [kind, setKind] = useState<ConditionKind>("price_below");
  const [valueText, setValueText] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = CONDITION_KINDS[kind];
  const draft = {
    symbol: token?.symbol ?? "",
    usdcAmount: Number(amountText),
    condition: toCondition(kind, Number(valueText)),
    repeat,
  };
  const parsed = newStrategySchema.safeParse(draft);
  const signedIn = session.status === "signed-in";

  const save = async () => {
    setError(null);
    if (!token) return setError("Pick a token.");
    if (!parsed.success) return setError(problem(parsed.error.issues[0]?.path[0]));
    setSaving(true);
    try {
      if (!signedIn) await session.signIn();
      onCreated(await strategiesApi.create(parsed.data));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? e.message : friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("space-y-3 text-[14px] tracking-[-0.01em]", className)}>
      {onCancel && (
        <RevealRow className="flex items-center justify-between">
          <p className="font-semibold text-text-extra-high">New strategy</p>
          <IconButton
            onClick={onCancel}
            aria-label="Close"
            className="-my-1 size-7 [&_svg]:size-3.5"
          >
            <X />
          </IconButton>
        </RevealRow>
      )}

      {!hideToken && (
        <RevealRow>
          {token ? (
            <div className="flex h-11 items-center gap-2.5 rounded-[14px] bg-soft px-3">
              <TokenLogo src={token.icon} symbol={token.symbol} className="size-6" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-text-extra-high">{token.symbol}</span>{" "}
                <span className="text-ink-muted">
                  {token.name} · {issuerLabel(token.issuer)}
                </span>
              </span>
              {!fixed && (
                <IconButton
                  onClick={() => setPicked(null)}
                  aria-label="Change token"
                  className="size-7 [&_svg]:size-3.5"
                >
                  <X />
                </IconButton>
              )}
            </div>
          ) : (
            <TokenSearch onPick={setPicked} />
          )}
        </RevealRow>
      )}

      <RevealRow className="grid grid-cols-2 gap-2">
        <label className="space-y-1.5">
          <span className="px-1 text-[12.5px] font-medium text-ink-muted">Buy</span>
          <span className={FIELD}>
            <input
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder={String(MIN_ORDER_USD)}
              aria-label="USDC to spend"
              className="min-w-0 flex-1 bg-transparent font-medium text-text-extra-high tabular-nums outline-none placeholder:text-[#B9B8C3]"
            />
            <span className="text-[12.5px] font-medium text-ink-muted">USDC</span>
          </span>
        </label>
        <label className="space-y-1.5">
          <span className="px-1 text-[12.5px] font-medium text-ink-muted">{field.field}</span>
          <span className={FIELD}>
            <input
              inputMode="decimal"
              value={valueText}
              onChange={(e) => setValueText(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
              aria-label={`${field.field} (${field.unit})`}
              className="min-w-0 flex-1 bg-transparent font-medium text-text-extra-high tabular-nums outline-none placeholder:text-[#B9B8C3]"
            />
            <span className="text-[12.5px] font-medium text-ink-muted">{field.unit}</span>
          </span>
        </label>
      </RevealRow>

      <RevealRow>
        <SegmentedControl
          aria-label="Condition"
          className="grid w-full grid-cols-5"
          items={KINDS}
          value={kind}
          onValueChange={(next) => {
            setKind(next);
            setValueText("");
          }}
        />
      </RevealRow>

      <RevealRow className="flex items-center justify-between gap-3 px-1">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-high">
          <input
            type="checkbox"
            checked={repeat}
            onChange={(e) => setRepeat(e.target.checked)}
            className="size-4 accent-gray-1400"
          />
          Repeat after each buy
        </label>
        {token && parsed.success && (
          <span className="truncate text-[12.5px] text-ink-muted">
            {describeStrategy({ ...parsed.data, symbol: token.symbol })}
          </span>
        )}
      </RevealRow>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 px-1 text-[12.5px] text-status-error-text"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <SoftButton dark className="h-11 w-full" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : signedIn ? "Create strategy" : "Sign in and create"}
      </SoftButton>
    </div>
  );
}

const problem = (field: PropertyKey | undefined) =>
  field === "usdcAmount"
    ? `Amount must be at least ${MIN_ORDER_USD} USDC.`
    : field === "condition"
      ? "Enter a valid number for the condition."
      : "Check the strategy's fields.";

/** Search Jupiter's stock tokens and pick one. */
function TokenSearch({ onPick }: { onPick: (token: StrategyToken) => void }) {
  const [query, setQuery] = useState("");
  const results = useStockSearch(query);
  const tokens = (results.data?.stocks ?? []).flatMap((stock) =>
    stock.tokens.map((t) => ({ ...t, name: stock.name })),
  );
  return (
    <div className="space-y-1">
      <span className={FIELD}>
        <Search className="mr-2 size-4 text-ink-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a stock"
          aria-label="Search a stock"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted"
        />
      </span>
      {query.trim() && (
        <ul className="max-h-56 overflow-y-auto rounded-[14px] bg-white p-1 shadow-hairline">
          {results.loading && <li className="px-3 py-2 text-[13px] text-ink-muted">Searching…</li>}
          {results.error && (
            <li className="px-3 py-2 text-[13px] text-status-error-text">{results.error}</li>
          )}
          {!results.loading && !results.error && tokens.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-ink-muted">No matches</li>
          )}
          {tokens.slice(0, 12).map((t) => (
            <li key={t.mint}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-left hover:bg-soft"
              >
                <TokenLogo src={t.icon} symbol={t.symbol} className="size-6" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-text-extra-high">{t.symbol}</span>{" "}
                  <span className="text-ink-muted">
                    {t.name} · {issuerLabel(t.issuer)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

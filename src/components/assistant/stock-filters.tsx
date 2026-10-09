"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ChevronDown, Info } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DEFAULT_DIR,
  type BrowseFilters,
  type LiquidityFilter,
  type SortKey,
  type TypeFilter,
} from "@/lib/stocks/browse";
import { cn } from "@/lib/utils";

/** A filter button: compact, shows its value, highlighted while it filters something. */
const triggerClass = (active: boolean, block?: boolean) =>
  cn(
    "h-8 gap-1 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
    active
      ? "border-primary/50 bg-primary/10 text-foreground"
      : "border-input bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-input/30",
    block && "w-full justify-between",
  );

type Option = { name: string; count: number };

/** "Sector", "Sector: Technology", "Sector: 2 selected". */
export const multiLabel = (label: string, selected: string[]) =>
  selected.length === 0
    ? label
    : selected.length === 1
      ? `${label}: ${selected[0]}`
      : `${label}: ${selected.length} selected`;

/** Several choices with checkboxes, in a popover with a search box (Popover + Command). */
export function MultiSelectFilter({
  label,
  allLabel,
  options,
  selected,
  onChange,
  disabled,
  disabledHint,
  searchable,
  block,
}: {
  label: string;
  /** The "everything" option at the top (clears the selection). */
  allLabel: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  disabledHint?: string;
  /** A long list: the input invites searching rather than filtering. */
  searchable?: boolean;
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? disabledHint : undefined}
          aria-label={disabled && disabledHint ? `${label}: ${disabledHint}` : undefined}
          className={cn("inline-flex items-center", triggerClass(selected.length > 0, block))}
        >
          <span className="truncate">{multiLabel(label, selected)}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          {/* The input also takes the arrow keys (and Enter) for the list, so it's always there. */}
          <CommandInput
            placeholder={
              searchable ? `Search ${label.toLowerCase()}…` : `Filter ${label.toLowerCase()}s…`
            }
          />
          <CommandList className="max-h-72">
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={`__all ${allLabel}`}
                data-checked={selected.length === 0}
                onSelect={() => onChange([])}
              >
                <span className="text-sm">{allLabel}</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((o) => {
                const checked = selected.includes(o.name);
                return (
                  <CommandItem
                    key={o.name}
                    value={o.name}
                    aria-checked={checked}
                    onSelect={() => toggle(o.name)}
                    className="[&>svg:last-child]:hidden"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">({o.count})</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** A single-choice dropdown (Select) whose button reads "Label: value". */
function SingleSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  defaultValue,
  block,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean; hint?: string }[];
  onChange: (value: T) => void;
  defaultValue: T;
  block?: boolean;
}) {
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger
        size="sm"
        aria-label={`${label}: ${current}`}
        className={cn(triggerClass(value !== defaultValue, block), "pr-2")}
      >
        <SelectValue>
          {label}: {current}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            <span>{o.label}</span>
            {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TypeSelect(props: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  block?: boolean;
}) {
  return (
    <SingleSelect
      label="Type"
      defaultValue="all"
      options={[
        { value: "all", label: "All" },
        { value: "stock", label: "Stocks" },
        { value: "etf", label: "ETFs" },
      ]}
      {...props}
    />
  );
}

export const LIQUIDITY_HELP =
  "How much a 100 USDC buy moves the price (from the registry's test quote). High: 0.25% or less. Medium: up to 1%. Low-liquidity stocks move more on small buys.";

export function LiquiditySelect({
  value,
  onChange,
  block,
}: {
  value: LiquidityFilter;
  onChange: (v: LiquidityFilter) => void;
  block?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", block && "w-full")}>
      <SingleSelect
        label="Liquidity"
        value={value}
        onChange={onChange}
        defaultValue="any"
        block={block}
        options={[
          { value: "any", label: "Any" },
          { value: "high", label: "High" },
          { value: "medium", label: "Medium+" },
        ]}
      />
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="What liquidity means"
              className="rounded-full p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-60 text-xs">
            {LIQUIDITY_HELP}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

export const SORT_LABELS: Record<SortKey, string> = {
  liquidity: "Liquidity",
  mcap: "Market cap",
  change: "24h change",
  return: "1Y return",
  name: "Name (A–Z)",
};

/** Sort field (options without data are disabled) and an ascending/descending toggle. */
export function SortControl({
  filters,
  available,
  onChange,
  block,
}: {
  filters: Pick<BrowseFilters, "sort" | "dir">;
  /** Which figures exist (null while loading). */
  available: { mcap: boolean; change: boolean; return: boolean } | null;
  onChange: (sort: BrowseFilters["sort"], dir: BrowseFilters["dir"]) => void;
  block?: boolean;
}) {
  const hint = (ok: boolean | undefined) =>
    available === null ? "loading…" : ok ? undefined : "needs market data";
  const asc = filters.dir === "asc";
  return (
    <span className={cn("inline-flex items-center gap-1", block && "w-full")}>
      <SingleSelect<SortKey>
        label="Sort"
        value={filters.sort}
        defaultValue="liquidity"
        block={block}
        onChange={(sort) => onChange(sort, DEFAULT_DIR[sort])}
        options={[
          { value: "liquidity", label: SORT_LABELS.liquidity },
          {
            value: "mcap",
            label: SORT_LABELS.mcap,
            disabled: !available?.mcap,
            hint: hint(available?.mcap),
          },
          {
            value: "change",
            label: SORT_LABELS.change,
            disabled: !available?.change,
            hint: hint(available?.change),
          },
          {
            value: "return",
            label: SORT_LABELS.return,
            disabled: !available?.return,
            hint: hint(available?.return),
          },
          { value: "name", label: SORT_LABELS.name },
        ]}
      />
      <Button
        variant="outline"
        size="icon-sm"
        className="size-8 shrink-0"
        onClick={() => onChange(filters.sort, asc ? "desc" : "asc")}
        aria-label={
          asc ? "Sorted ascending; switch to descending" : "Sorted descending; switch to ascending"
        }
        title={asc ? "Ascending" : "Descending"}
      >
        {asc ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
      </Button>
    </span>
  );
}

/** A removable chip for one active filter. */
export function FilterChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-0.5 pr-1 pl-2 text-[11px] text-foreground">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${typeof children === "string" ? children : ""}`.trim()}
        className="rounded-full p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}

"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select } from "radix-ui";

import { formatPrice } from "@/components/market/format";
import { issuerLabel } from "@/components/market/stock-figures";
import { TokenLogo } from "@/components/market/token-logo";
import type { StockToken } from "@/lib/stocks/types";

/** Pick one of a company's tokens: logo, symbol, issuer, and its price on the right. */
export function TokenSelect({
  tokens,
  value,
  onChange,
  disabled,
}: {
  tokens: StockToken[];
  value: string;
  onChange: (token: StockToken) => void;
  disabled?: boolean;
}) {
  const selected = tokens.find((t) => t.mint === value) ?? tokens[0]!;
  return (
    <Select.Root
      value={selected.mint}
      disabled={disabled}
      onValueChange={(mint) => {
        const next = tokens.find((t) => t.mint === mint);
        if (next) onChange(next);
      }}
    >
      <Select.Trigger
        aria-label="Token"
        className="group flex h-11 w-full items-center gap-2.5 rounded-[14px] bg-[#F4F4F9] pr-3.5 pl-4 text-left text-[14px] text-text-extra-high transition-[background-color,box-shadow] outline-none hover:bg-[#EEEEF4] focus-visible:ring-2 focus-visible:ring-gray-1200/40 disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:bg-white data-[state=open]:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <TokenLogo src={selected.icon} symbol={selected.symbol} className="size-5 text-[8px]" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">{selected.symbol}</span>
          <span className="ml-1.5 text-[#868593]">{issuerLabel(selected.issuer)}</span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-[#868593] transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-50 w-[var(--radix-select-trigger-width)] origin-[var(--radix-select-content-transform-origin)] rounded-[16px] bg-white p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=bottom]:slide-in-from-top-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
        >
          <Select.Viewport>
            {tokens.map((t) => (
              <Select.Item
                key={t.mint}
                value={t.mint}
                className="relative flex h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-[14px] text-text-extra-high outline-none select-none data-[highlighted]:bg-[#F4F4F9]"
              >
                <TokenLogo src={t.icon} symbol={t.symbol} className="size-5 text-[8px]" />
                <Select.ItemText>
                  <span className="font-semibold">{t.symbol}</span>
                </Select.ItemText>
                <span className="truncate text-[#868593]">{issuerLabel(t.issuer)}</span>
                <span className="ml-auto text-[12.5px] text-[#868593] tabular-nums">
                  {formatPrice(t.price)}
                </span>
                <span className="flex w-4 justify-end">
                  <Select.ItemIndicator>
                    <Check className="size-4 text-text-extra-high" aria-hidden />
                  </Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

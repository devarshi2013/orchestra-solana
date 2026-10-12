"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";
import type { WalletOptionProps } from "@/types/wallet";

export function WalletOption({ name, icon, trailing, disabled, onClick, href }: WalletOptionProps) {
  const body = (
    <>
      <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg bg-wallet-icon-bg">
        {icon ? (
          <Image
            src={icon}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            unoptimized
          />
        ) : (
          <span className="text-sm font-medium text-wallet-fg-muted">{name.charAt(0)}</span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-sm leading-[128%] tracking-[-0.02em] text-wallet-fg">
        {name}
      </span>
      {trailing && <span className="text-xs text-wallet-fg-subtle">{trailing}</span>}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="wallet-tile-in wallet-option"
      >
        {body}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "wallet-tile-in wallet-option",
        disabled && "cursor-not-allowed opacity-50 active:scale-100",
      )}
    >
      {body}
    </button>
  );
}

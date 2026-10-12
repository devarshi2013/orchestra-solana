"use client";

import { useWalletModalStore } from "@/stores/wallet-modal";
import { cn } from "@/lib/utils";

const SIZE_CLS = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-4 text-sm",
} as const;

export function ConnectWalletButton({
  size = "md",
  className,
  label = "Connect Wallet",
}: {
  size?: keyof typeof SIZE_CLS;
  className?: string;
  label?: string;
}) {
  const setOpen = useWalletModalStore((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md border border-wallet-btn-border bg-gradient-to-b from-wallet-btn-surface-hover to-wallet-btn-surface font-medium text-wallet-btn-fg transition-all select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.25),0_4px_10px_rgba(0,0,0,0.08)]",
        "hover:border-wallet-btn-fg/30 hover:from-[var(--wallet-btn-surface-hover)] hover:to-[var(--wallet-btn-surface-hover)]",
        "active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]",
        SIZE_CLS[size],
        className,
      )}
    >
      {label}
    </button>
  );
}

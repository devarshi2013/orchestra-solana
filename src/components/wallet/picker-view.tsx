"use client";

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import { DrawerClose, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { WalletOption } from "@/components/wallet/wallet-options";
import { MORE_WALLETS, POPULAR_WALLETS } from "@/lib/constants";
import type {
  PickerSection,
  PickerViewProps,
  PopularWallet,
  WalletStandardWallet,
} from "@/types/wallet";

const without = (list: readonly PopularWallet[], excl: ReadonlySet<string>) =>
  list.filter((w) => !excl.has(w.name));

const installs = (list: readonly PopularWallet[]) =>
  list.map((p) => (
    <WalletOption
      key={p.name}
      name={p.name}
      href={p.downloadUrl}
      icon={p.icon}
      trailing="Install"
    />
  ));

export function PickerView({ wallets, status, connect, onOpenChange }: PickerViewProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const installed = useMemo(() => new Set(wallets.map((w) => w.name)), [wallets]);
  const popular = useMemo(() => without(POPULAR_WALLETS, installed), [installed]);
  const extras = useMemo(() => without(MORE_WALLETS, installed), [installed]);
  const combined = useMemo(() => [...popular, ...extras], [popular, extras]);
  const visible = useMemo(() => (expanded ? combined : combined.slice(0, 4)), [combined, expanded]);

  const handleSelect = useCallback(
    async (target: WalletStandardWallet) => {
      setPending(target.name);
      setConnectError(null);
      try {
        await connect(target);
        onOpenChange(false);
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : `Failed to connect to ${target.name}`);
      } finally {
        setPending(null);
      }
    },
    [connect, onOpenChange],
  );

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  const isConnecting = status === "connecting";
  const sections: PickerSection[] = wallets.length
    ? ([
        {
          title: "Recently Used",
          tiles: wallets.map((w) => (
            <WalletOption
              key={w.name}
              name={w.name}
              icon={w.icon}
              onClick={() => handleSelect(w)}
              disabled={isConnecting && pending !== w.name}
              trailing={pending === w.name ? "Connecting…" : undefined}
            />
          )),
        },
        visible.length > 0 && {
          title: "More Wallets",
          action: combined.length > 4 && (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-label={expanded ? "View less" : "View more"}
              aria-expanded={expanded}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-wallet-fg-muted transition-[background-color,color] duration-200 ease-(--ease-out-strong) hover:bg-wallet-icon-bg hover:text-wallet-fg focus-visible:ring-1 focus-visible:ring-wallet-fg-subtle focus-visible:outline-none motion-reduce:transition-none"
            >
              <Icon
                name="dropdown-arrow"
                className={`h-6.5 w-6.5 transition-transform duration-200 ease-(--ease-out-strong) motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          ),
          tiles: installs(visible),
        },
      ].filter(Boolean) as PickerSection[])
    : ([
        popular.length > 0 && { title: "Popular Wallets", tiles: installs(popular) },
        extras.length > 0 && { title: "More Wallets", tiles: installs(extras) },
      ].filter(Boolean) as PickerSection[]);

  return (
    <>
      <DrawerHeader className="flex flex-row items-start justify-between gap-3 pt-1.5 pb-2 group-data-[vaul-drawer-direction=right]/drawer-content:pt-6">
        <div className="flex flex-col gap-0.5">
          <DrawerTitle className="text-left text-lg tracking-[-0.02em] text-wallet-fg">
            Connect Wallet
          </DrawerTitle>
        </div>
        <DrawerClose
          aria-label="Close"
          className="icon-button hidden group-data-[vaul-drawer-direction=right]/drawer-content:flex"
        >
          <X size={16} strokeWidth={2} />
        </DrawerClose>
      </DrawerHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-2 pb-5">
        {connectError && <p className="text-xs text-wallet-danger">{connectError}</p>}

        {sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-2">
            <div className="flex h-5 items-center justify-between">
              <h3 className="text-[13px] leading-[124%] font-medium tracking-[-0.02em] text-wallet-fg-muted">
                {s.title}
              </h3>
              {s.action}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{s.tiles}</div>
          </section>
        ))}

        <p className="rounded-xl border border-wallet-border bg-wallet-icon-bg px-4 py-3 text-xs leading-[148%] tracking-[-0.02em] text-wallet-fg-muted">
          By connecting, you agree to the{" "}
          <a href="/terms" className="text-wallet-fg underline-offset-2 hover:underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/risk" className="text-wallet-fg underline-offset-2 hover:underline">
            Risks
          </a>
          .
        </p>
      </div>
    </>
  );
}

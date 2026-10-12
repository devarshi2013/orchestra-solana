"use client";

import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { PickerView } from "@/components/wallet/picker-view";
import { useWalletContext } from "@/components/wallet/wallet-provider";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import type { WalletDrawerProps } from "@/types/wallet";

export function ConnectWalletDrawer({ open, onOpenChange }: WalletDrawerProps) {
  const { wallets, status, connect } = useWalletContext();
  const isDesktop = useIsDesktop();

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={isDesktop ? "right" : "bottom"}>
      <DrawerContent
        className={
          "data-[vaul-drawer-direction=bottom]:max-h-[85vh] data-[vaul-drawer-direction=bottom]:max-w-110 " +
          "data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-110 " +
          "data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:border-wallet-border " +
          "data-[vaul-drawer-direction=right]:bg-wallet-surface"
        }
      >
        <PickerView
          wallets={wallets}
          status={status}
          connect={connect}
          onOpenChange={onOpenChange}
        />
      </DrawerContent>
    </Drawer>
  );
}

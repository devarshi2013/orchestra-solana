"use client";

import { useState } from "react";

import { Menu, MenuItem } from "@/components/ui/menu";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { useWalletContext } from "@/components/wallet/wallet-provider";
import { useOutsideClick } from "@/hooks/use-outside-click";

/** The header's wallet control, as in perps: Connect Wallet, or the address with a copy / disconnect menu. */
export function WalletButton() {
  const { account, status, disconnect } = useWalletContext();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useOutsideClick<HTMLDivElement>(walletMenuOpen, () =>
    setWalletMenuOpen(false),
  );
  const connected = status === "connected";
  const shortAddress = account?.address
    ? `${account.address.slice(0, 4)}...${account.address.slice(-4)}`
    : null;

  if (!connected || !shortAddress) {
    return (
      <ConnectWalletButton label={status === "connecting" ? "Connecting…" : "Connect Wallet"} />
    );
  }
  return (
    <div className="relative" ref={walletMenuRef}>
      <button
        onClick={() => setWalletMenuOpen((o) => !o)}
        aria-label="Wallet menu"
        aria-haspopup="menu"
        aria-expanded={walletMenuOpen}
        className="flex cursor-pointer items-center rounded-md border border-wallet-btn-border px-3 py-1.5 text-xs text-wallet-btn-fg transition-colors hover:bg-wallet-btn-surface-hover"
      >
        {shortAddress}
      </button>
      {walletMenuOpen && (
        <Menu className="right-0 min-w-[9rem] p-1">
          <MenuItem
            active={false}
            onClick={() => {
              if (account?.address) navigator.clipboard?.writeText(account.address);
              setWalletMenuOpen(false);
            }}
          >
            Copy address
          </MenuItem>
          <MenuItem
            active={false}
            onClick={() => {
              setWalletMenuOpen(false);
              void disconnect();
            }}
          >
            Disconnect
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}

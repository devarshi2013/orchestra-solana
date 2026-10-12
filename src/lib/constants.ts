import type { PopularWallet } from "@/types/wallet";

export const STORAGE_WALLET_NAME = "tickertape:wallet-name";

export const POPULAR_WALLETS: readonly PopularWallet[] = [
  { name: "Phantom", downloadUrl: "https://phantom.app/download", icon: "/wallets/phantom.png" },
  { name: "Solflare", downloadUrl: "https://solflare.com/download", icon: "/wallets/solflare.png" },
  {
    name: "Backpack",
    downloadUrl: "https://backpack.app/downloads",
    icon: "/wallets/backpack.ico",
  },
  {
    name: "Coinbase Wallet",
    downloadUrl: "https://www.coinbase.com/wallet/downloads",
    icon: "/wallets/coinbase-wallet.ico",
  },
  { name: "Trust", downloadUrl: "https://trustwallet.com/download", icon: "/wallets/trust.ico" },
  { name: "Ledger", downloadUrl: "https://www.ledger.com/start", icon: "/wallets/ledger.png" },
];

export const MORE_WALLETS: readonly PopularWallet[] = [
  {
    name: "Bitget",
    downloadUrl: "https://web3.bitget.com/en/wallet-download",
    icon: "/wallets/bitget.ico",
  },
  {
    name: "Magic Eden",
    downloadUrl: "https://wallet.magiceden.io",
    icon: "/wallets/magic-eden.png",
  },
  { name: "Coin98", downloadUrl: "https://coin98.com/wallet", icon: "/wallets/coin98.ico" },
  { name: "Exodus", downloadUrl: "https://www.exodus.com/download/", icon: "/wallets/exodus.svg" },
  { name: "Glow", downloadUrl: "https://glow.app", icon: "/wallets/glow.png" },
];

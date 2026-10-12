import type { WalletStandardWallet } from "@/types/wallet";

export function requireFeature<T>(wallet: WalletStandardWallet, name: string): T {
  const feature = wallet.features[name];
  if (!feature) throw new Error(`${wallet.name} does not support ${name}`);
  return feature as T;
}

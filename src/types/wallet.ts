export type WalletAccount = {
  address: string;
  publicKey: Uint8Array;
  chains: readonly string[];
  features: readonly string[];
  label?: string;
  icon?: string;
};

export type WalletStandardWallet = {
  version: string;
  name: string;
  icon: string;
  chains: readonly string[];
  features: Record<string, unknown>;
  accounts: readonly WalletAccount[];
};

export type ConnectFeature = {
  version: string;
  connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }>;
};

export type DisconnectFeature = {
  version: string;
  disconnect: () => Promise<void>;
};

type EventsChange = {
  accounts?: readonly WalletAccount[];
  chains?: readonly string[];
  features?: Record<string, unknown>;
};

export type EventsFeature = {
  version: string;
  on: (event: "change", listener: (changes: EventsChange) => void) => () => void;
};

export type SignMessageFeature = {
  version: string;
  signMessage: (
    ...inputs: { account: WalletAccount; message: Uint8Array }[]
  ) => Promise<readonly { signedMessage: Uint8Array; signature: Uint8Array }[]>;
};

export type SignTransactionFeature = {
  version: string;
  signTransaction: (
    ...inputs: { account: WalletAccount; transaction: Uint8Array; chain: string }[]
  ) => Promise<readonly { signedTransaction: Uint8Array }[]>;
};

export type WalletStatus = "disconnected" | "connecting" | "connected";

export type WalletContextValue = {
  wallets: readonly WalletStandardWallet[];
  wallet: WalletStandardWallet | null;
  account: WalletAccount | null;
  status: WalletStatus;
  connect: (wallet: WalletStandardWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Uint8Array, chain?: string) => Promise<Uint8Array>;
};

export type PopularWallet = {
  name: string;
  downloadUrl: string;
  icon?: string;
};

export type PickerSection = {
  title: string;
  action?: React.ReactNode;
  tiles: React.ReactNode;
};

export type WalletOptionProps = {
  name: string;
  icon?: string;
  trailing?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
};

export type WalletDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type PickerViewProps = {
  wallets: readonly WalletStandardWallet[];
  status: WalletStatus;
  connect: (wallet: WalletStandardWallet) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

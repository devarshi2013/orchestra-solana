import { create } from "zustand";

type WalletModalState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const useWalletModalStore = create<WalletModalState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

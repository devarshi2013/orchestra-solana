import { create } from "zustand";

import { DEFAULT_TOKENS, type TokenInfo } from "@/lib/tokens";

type SwapFormState = {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  /** Raw user input, in whole tokens (e.g. "1.5"). */
  amount: string;
  setInputToken: (token: TokenInfo) => void;
  setOutputToken: (token: TokenInfo) => void;
  setAmount: (amount: string) => void;
  flip: () => void;
};

const [SOL, USDC] = DEFAULT_TOKENS as [TokenInfo, TokenInfo];

export const useSwapForm = create<SwapFormState>()((set) => ({
  inputToken: SOL,
  outputToken: USDC,
  amount: "",
  // Picking the token already on the other side swaps the pair instead of duplicating it.
  setInputToken: (token) =>
    set((s) =>
      token.mint === s.outputToken.mint
        ? { inputToken: token, outputToken: s.inputToken }
        : { inputToken: token },
    ),
  setOutputToken: (token) =>
    set((s) =>
      token.mint === s.inputToken.mint
        ? { outputToken: token, inputToken: s.outputToken }
        : { outputToken: token },
    ),
  setAmount: (amount) => set({ amount }),
  flip: () => set((s) => ({ inputToken: s.outputToken, outputToken: s.inputToken, amount: "" })),
}));

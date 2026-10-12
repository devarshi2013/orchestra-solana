/**
 * How each issuer names its tokens, keyed by the issuer tag Jupiter puts on
 * them. Used only to read a token's company ticker and name, so the same
 * company's tokens can be shown together. A token whose issuer isn't here is
 * still listed, on its own, under its own symbol and name.
 */
export const ISSUERS = {
  xstocks: { label: "xStocks", ticker: /^(.+)x$/, name: / xStock$/ },
  ondo: { label: "Ondo", ticker: /^(.+)on$/, name: / \(Ondo Tokenized\)$/ },
  backpack: { label: "Backpack", ticker: /^(.+)$/, name: / - Backpack Securities$/ },
  prestocks: { label: "PreStocks", ticker: /^(.+)$/, name: / PreStocks$/ },
  tessera: { label: "Tessera", ticker: /^t(.+)$/, name: /^T-/ },
} as const;

export type IssuerId = keyof typeof ISSUERS;

export const isIssuer = (tag: string): tag is IssuerId => Object.hasOwn(ISSUERS, tag);

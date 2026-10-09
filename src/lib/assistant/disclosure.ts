/**
 * The one-time risk disclosure every wallet accepts before using the
 * assistant. Changing the points? Bump the version so everyone accepts again.
 */
export const ASSISTANT_DISCLOSURE_VERSION = 2;

export const DISCLOSURE_POINTS = [
  {
    title: "AI can be wrong",
    text: "The assistant can misread data, miss context or make mistakes. Check the data it used (shown under each answer) and every amount before you buy.",
  },
  {
    title: "Not financial advice",
    text: "Plans are research generated from live market data, not a recommendation suited to your situation. You decide, and you sign every trade yourself.",
  },
  {
    title: "Tokenized stocks are securities",
    text: "Ondo and xStocks tokens are securities with eligibility rules: they aren't available to US persons, xStocks excludes the UK, and other countries may restrict them. Only buy them if you're eligible where you live.",
  },
  {
    title: "You can lose money",
    text: "Stock prices can fall sharply, and tokenized stocks add on-chain risks: issuer pauses, thin liquidity and price gaps outside US market hours.",
  },
] as const;

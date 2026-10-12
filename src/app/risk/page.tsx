import type { Metadata } from "next";

import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = {
  title: "Risk disclosure",
  description: "The risks of using Tickertape and buying tokenized stocks on Solana.",
};

const POINTS = [
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
    text: "Tokenized stocks are securities, and each issuer sets who may buy them: most aren't available to US persons, and many other countries restrict them. Some tokens aren't plain shares: leveraged or inverse products, or exposure to private companies through an issuer structure. Only buy them if you're eligible where you live.",
  },
  {
    title: "You can lose money",
    text: "Stock prices can fall sharply, and tokenized stocks add on-chain risks: issuer pauses, thin liquidity and price gaps outside US market hours.",
  },
];

export default function RiskPage() {
  return (
    <ProsePage eyebrow="Before you buy" title="Risk disclosure" updated="October 2026">
      <p>
        Tickertape is research software. It suggests tokenized stocks and shows live quotes, but
        every purchase is a swap you review and sign in your own wallet.
      </p>
      {POINTS.map((point) => (
        <section key={point.title}>
          <h2>{point.title}</h2>
          <p>{point.text}</p>
        </section>
      ))}
      <section>
        <h2>On-chain and issuer risks</h2>
        <ul>
          <li>Issuers can pause their tokens, freeze accounts, or change how a token works.</li>
          <li>Liquidity can be thin, especially outside US market hours, so prices can gap.</li>
          <li>Pre-IPO tokens give economic exposure through an issuer structure, not shares.</li>
          <li>Transactions on Solana are final once confirmed.</li>
        </ul>
      </section>
      <p className="text-body-md text-text-low">
        Each issuer sets its own eligibility rules. Read the issuers&apos; own documents before
        buying.
      </p>
    </ProsePage>
  );
}

import type { Metadata } from "next";

import { ProsePage } from "@/components/layout/prose-page";
import { DISCLOSURE_POINTS } from "@/lib/assistant/disclosure";

export const metadata: Metadata = {
  title: "Risk disclosure",
  description: "The risks of using Quill and buying tokenized stocks on Solana.",
};

export default function RiskPage() {
  return (
    <ProsePage eyebrow="Before you buy" title="Risk disclosure" updated="October 2026">
      <p>
        Quill is research software. It suggests tokenized stocks and shows live quotes, but every
        purchase is a swap you review and sign in your own wallet. These are the same points you
        accept before using the assistant.
      </p>
      {DISCLOSURE_POINTS.map((point) => (
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
      <p className="text-sm text-muted-foreground">
        Issuer details and eligibility rules are summarised in the{" "}
        <a
          href="https://github.com/devarshi2013/orchestra-solana/blob/main/docs/tokenized-stocks.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-text underline underline-offset-2"
        >
          tokenized stocks notes
        </a>
        . Read the issuers&apos; own documents before buying.
      </p>
    </ProsePage>
  );
}

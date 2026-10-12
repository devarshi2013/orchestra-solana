import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Plain-language terms for using Tickertape.",
};

const SECTIONS = [
  {
    title: "What Tickertape is",
    text: "Tickertape is software that researches tokenized stocks with an AI assistant and prepares swaps through Jupiter. It never holds your keys or funds, and it can't trade on its own: your wallet signs every transaction.",
  },
  {
    title: "No advice",
    text: "Nothing Tickertape shows is financial, investment, legal or tax advice. AI output can be wrong. You are responsible for your decisions and for checking every amount before you sign.",
  },
  {
    title: "Eligibility",
    text: "Tokenized stocks are securities with eligibility rules set by their issuers. They aren't available to US persons, and other countries restrict them. Only use Tickertape to buy them if you're allowed to where you live.",
  },
  {
    title: "Third parties",
    text: "Quotes and swaps come from Jupiter, market data from third-party providers, and the tokens from their issuers. Their availability and terms are outside our control.",
  },
  {
    title: "Your data",
    text: "Tickertape has no accounts and no database. Your chats are kept in your own browser. To answer, your messages and your public wallet address are sent to the AI provider and to Jupiter.",
  },
  {
    title: "As is",
    text: "Tickertape is provided as is, without warranties. To the extent the law allows, we aren't liable for losses from using it, including failed or mispriced swaps.",
  },
];

export default function TermsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Terms of use" updated="October 2026">
      <p>
        These terms are a plain-language summary of how Tickertape works and what you agree to by
        using it. They are not legal advice.
      </p>
      {SECTIONS.map(({ title, text }) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      <p className="text-body-md text-text-low">
        See also the <Link href="/risk">risk disclosure</Link>.
      </p>
    </ProsePage>
  );
}

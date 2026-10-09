import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/layout/prose-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Plain-language terms for using Quill.",
};

export default function TermsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Terms of use" updated="October 2026">
      <p>
        These terms are a plain-language summary of how Quill works and what you agree to by using
        it. They are not legal advice.
      </p>
      <section>
        <h2>What Quill is</h2>
        <p>
          Quill is software that researches tokenized stocks with an AI assistant and prepares swaps
          through Jupiter. It never holds your keys or funds, and it can&apos;t trade on its own:
          your wallet signs every transaction.
        </p>
      </section>
      <section>
        <h2>No advice</h2>
        <p>
          Nothing Quill shows is financial, investment, legal or tax advice. AI output can be wrong.
          You are responsible for your decisions and for checking every amount before you sign.
        </p>
      </section>
      <section>
        <h2>Eligibility</h2>
        <p>
          Tokenized stocks are securities with eligibility rules set by their issuers. They
          aren&apos;t available to US persons, and other countries restrict them. Only use Quill to
          buy them if you&apos;re allowed to where you live.
        </p>
      </section>
      <section>
        <h2>Third parties</h2>
        <p>
          Quotes and swaps come from Jupiter, market data from third-party providers, and the tokens
          from their issuers. Their availability and terms are outside our control.
        </p>
      </section>
      <section>
        <h2>Your data</h2>
        <p>
          Quill has no accounts and no database. Your chats are kept in your own browser. To answer,
          your messages and your public wallet address are sent to the AI provider and to Jupiter.
        </p>
      </section>
      <section>
        <h2>As is</h2>
        <p>
          Quill is provided as is, without warranties. To the extent the law allows, we aren&apos;t
          liable for losses from using it, including failed or mispriced swaps.
        </p>
      </section>
      <p className="text-sm text-muted-foreground">
        See also the{" "}
        <Link href="/risk" className="text-primary-text underline underline-offset-2">
          risk disclosure
        </Link>
        .
      </p>
    </ProsePage>
  );
}

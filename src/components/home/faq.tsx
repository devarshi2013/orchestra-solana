import { Plus } from "lucide-react";

import { Reveal } from "@/components/motion";

import { Accent } from "@/components/design/text";

const QUESTIONS = [
  {
    q: "Does Quill hold my money?",
    a: "No. Quill never holds funds or keys. Every trade is a swap you review and sign in your own wallet, and nothing is signed automatically.",
  },
  {
    q: "What can I research and buy?",
    a: "Tokenized US stocks and ETFs available on Solana through Jupiter. You pay in USDC and receive the stock token in your wallet.",
  },
  {
    q: "Who can buy tokenized stocks?",
    a: "Tokenized stocks are securities with eligibility rules. They aren't available to US persons, and some other countries restrict them. Check what applies where you live before buying.",
  },
  {
    q: "What does it cost?",
    a: "Quill adds no fee of its own. Each swap shows Jupiter's fee and the network fee before you approve it.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Quill is a research tool. The AI can be wrong, so check the data it used and decide for yourself.",
  },
];

/** Frequently asked questions, as native disclosure widgets (keyboard and screen-reader friendly). */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 section-y">
      <div className="mx-auto grid max-w-6xl gap-[var(--section-head-gap)] px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <Reveal>
          <h2
            id="faq-heading"
            className="text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl"
          >
            Questions, <Accent>answered</Accent>
          </h2>
        </Reveal>
        <Reveal delay={0.06}>
          <ul className="divide-y border-y">
            {QUESTIONS.map(({ q, a }) => (
              <li key={q}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    {q}
                    <Plus
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45"
                      aria-hidden
                    />
                  </summary>
                  <p className="max-w-2xl pb-5 text-sm leading-6 text-muted-foreground">{a}</p>
                </details>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

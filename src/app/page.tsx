import { KeyRound, ShieldCheck, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { MarketDashboard } from "@/components/market/market-dashboard";

const STEPS = [
  { title: "Ask", text: "Tell the assistant your budget and what you're looking for." },
  {
    title: "Review",
    text: "Edit amounts or remove stocks; live quotes and warnings update as you go.",
  },
  {
    title: "Approve",
    text: "Approve each swap in your wallet. Your USDC buys the stock tokens directly.",
  },
];

const PROMISES: { icon: ReactNode; text: string }[] = [
  { icon: <Wallet />, text: "Non-custodial: funds never leave your wallet" },
  { icon: <KeyRound />, text: "Every swap needs your approval" },
  { icon: <ShieldCheck />, text: "API keys stay on the server" },
];

/**
 * The home page: a live market dashboard (prices from Jupiter, history from
 * GeckoTerminal) with one button into the chat, in the hero.
 */
export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Live markets</h1>
          <p className="text-sm text-muted-foreground">
            Tokenized US stocks and Solana tokens, priced live by Jupiter.
          </p>
        </div>
        <MarketDashboard />
      </section>

      <section id="how-it-works" aria-labelledby="steps-heading" className="scroll-mt-20 border-t">
        <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-wider text-primary-text uppercase">
              How it works
            </p>
            <h2 id="steps-heading" className="text-3xl font-semibold tracking-tight">
              Ask, review, approve
            </h2>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="space-y-3 rounded-xl border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                  {i + 1}
                </span>
                <h3 className="type-h2">{step.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {PROMISES.map(({ icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-success"
              >
                {icon}
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

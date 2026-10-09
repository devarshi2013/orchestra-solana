import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Clock,
  Database,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <MessageSquare />,
    title: "Ask in plain English",
    text: "“Three large US tech stocks for 200 USDC” or “compare NVIDIA and Apple”: the assistant researches and proposes a plan.",
  },
  {
    icon: <Database />,
    title: "Every number has a source",
    text: "Market cap, P/E, growth and returns come from live data tools. Open “Data used” under any answer to check them.",
  },
  {
    icon: <Zap />,
    title: "Live Jupiter quotes",
    text: "Each stock in a plan gets a fresh quote: tokens out, price impact and fees, refreshed when you change an amount.",
  },
  {
    icon: <KeyRound />,
    title: "You approve every swap",
    text: "Nothing is signed automatically. Each buy is its own prompt in your wallet, with a Solscan link when it lands.",
  },
  {
    icon: <BadgeCheck />,
    title: "Verified stock tokens only",
    text: "Tokenized US stocks from xStocks and Ondo, checked against Jupiter. The AI can't suggest anything else.",
  },
  {
    icon: <Clock />,
    title: "Risk checks built in",
    text: "Warnings for high price impact, thin liquidity and US market hours, plus pre-flight checks before you buy.",
  },
];

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

const PROMISES = [
  { icon: <Wallet />, text: "Non-custodial: funds never leave your wallet" },
  { icon: <KeyRound />, text: "Every swap needs your approval" },
  { icon: <ShieldCheck />, text: "API keys stay on the server" },
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center"
        >
          <div className="h-112 w-4xl max-w-full rounded-full bg-brand opacity-[0.14] blur-3xl dark:opacity-20" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-size-[48px_48px] opacity-60"
        />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pb-28">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border bg-surface/80 py-1 pr-3 pl-1 text-xs font-medium shadow-xs backdrop-blur">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-primary-foreground">
                <Sparkles className="size-3" aria-hidden /> AI
              </span>
              Tokenized US stocks on Solana
            </span>

            <div className="space-y-5">
              <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Find US stocks on Solana,{" "}
                <span className="text-brand">with an AI that shows its work.</span>
              </h1>
              <p className="max-w-xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg sm:leading-8">
                Orchestra&apos;s assistant researches tokenized stocks like NVIDIA and Apple with
                live data, shows real Jupiter quotes, and buys them with your USDC only after you
                approve each swap in your wallet.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/assistant">
                  Ask the assistant <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/assets">Browse stocks</Link>
              </Button>
            </div>

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

          <HeroPreview />
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="border-t bg-surface-raised/40">
        <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase dark:text-accent-foreground">
              Research you can verify
            </p>
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              From question to stock, in one chat
            </h2>
            <p className="text-pretty text-muted-foreground">
              No custody, no hidden trades: the assistant proposes, you decide.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="flex h-full flex-col gap-4 rounded-xl border bg-card p-6 shadow-soft"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-5">
                  {feature.icon}
                </span>
                <span className="space-y-2">
                  <span className="block type-h3">{feature.title}</span>
                  <span className="block text-sm leading-6 text-muted-foreground">
                    {feature.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="steps-heading" className="border-t">
        <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase dark:text-accent-foreground">
              How it works
            </p>
            <h2 id="steps-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ask, review, approve
            </h2>
          </div>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="relative space-y-3 rounded-xl border bg-card p-6 shadow-soft"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-primary-foreground tabular-nums">
                  {i + 1}
                </span>
                <h3 className="type-h2">{step.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final call to action */}
      <section className="px-4 pb-8 sm:px-6">
        <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-brand px-6 py-14 text-center text-primary-foreground shadow-lift sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgb(255_255_255/0.22),transparent_45%),radial-gradient(circle_at_90%_100%,rgb(255_255_255/0.12),transparent_40%)]"
          />
          <div className="relative mx-auto max-w-2xl space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ask your first question
            </h2>
            <p className="text-pretty text-white/85">
              Connect a Solana wallet with some USDC and ask about any large US company. Tokenized
              stocks have eligibility rules (not for US persons), so check yours first.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="bg-white text-[oklch(0.3_0.12_285)] hover:bg-white/90"
              >
                <Link href="/assistant">
                  Open the assistant <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-white ring-1 ring-white/40 hover:bg-white/10 hover:text-white"
              >
                <Link href="/assets">See the stock list</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/** A static illustration of a chat and its plan (decorative: no real prices or data). */
function HeroPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-brand opacity-20 blur-2xl" />
      <div className="space-y-4 rounded-2xl border bg-card/90 p-5 shadow-lift backdrop-blur sm:p-6">
        <div className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          I have 100 USDC. Suggest two large US tech stocks.
        </div>
        <div className="flex items-start gap-2 text-sm">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-primary-foreground">
            <Bot className="size-4" />
          </span>
          <p className="rounded-lg bg-surface-raised px-3 py-2 text-muted-foreground">
            Ranked by market cap, with live quotes. Here&apos;s a plan; open &ldquo;Data used&rdquo;
            to check every figure.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Proposed plan · 100 USDC</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
              <Zap className="size-3" /> Live quotes
            </span>
          </div>
          {[
            { symbol: "NVDAx", name: "NVIDIA", usdc: 50 },
            { symbol: "AAPLx", name: "Apple", usdc: 50 },
          ].map((row) => (
            <div
              key={row.symbol}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{row.name}</span>{" "}
                <span className="rounded-md border px-1.5 py-0.5 text-xs font-semibold">
                  {row.symbol}
                </span>
              </span>
              <span className="text-muted-foreground tabular-nums">{row.usdc} USDC</span>
            </div>
          ))}
          <div className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground">
            <ShoppingCart className="size-4" /> Approve &amp; buy in your wallet
          </div>
        </div>
      </div>
    </div>
  );
}

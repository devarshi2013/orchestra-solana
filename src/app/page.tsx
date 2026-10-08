import {
  ArrowRight,
  ArrowRightLeft,
  Bot,
  Check,
  FlaskConical,
  GitBranch,
  KeyRound,
  Layers,
  Scale,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

const FEATURES: { icon: ReactNode; title: string; text: string; href: string; cta: string }[] = [
  {
    icon: <Layers />,
    title: "Build strategies as blocks",
    text: "Nest assets, weighted groups, if/else conditions and top-N filters into a symphony, with live validation as you go.",
    href: "/create",
    cta: "Open the editor",
  },
  {
    icon: <FlaskConical />,
    title: "Backtest before you commit",
    text: "Simulate on stored daily prices with fees and slippage, and compare against simply holding SOL.",
    href: "/backtest",
    cta: "Run a backtest",
  },
  {
    icon: <Bot />,
    title: "Research with an AI assistant",
    text: "Ask about tokenized stocks and crypto. Every figure comes from live data you can inspect, and plans are yours to approve.",
    href: "/assistant",
    cta: "Ask the assistant",
  },
  {
    icon: <Scale />,
    title: "Invest and rebalance",
    text: "Run a symphony on your own wallet. Orchestra plans each rebalance and you sign every swap.",
    href: "/invest",
    cta: "Start investing",
  },
  {
    icon: <ArrowRightLeft />,
    title: "Swap at the best route",
    text: "Quotes across Jupiter's routers with price impact, fees and minimum received shown up front.",
    href: "/swap",
    cta: "Open swap",
  },
  {
    icon: <ShieldCheck />,
    title: "Only verified assets",
    text: "A curated registry of liquid, Jupiter-verified tokens and tokenized stocks. No pasting random mint addresses.",
    href: "/assets",
    cta: "Browse assets",
  },
];

const STEPS = [
  {
    title: "Design",
    text: "Describe the rules in the editor, or ask the assistant to propose a symphony.",
  },
  {
    title: "Test",
    text: "See today's allocation and a backtest with realistic costs before any money moves.",
  },
  {
    title: "Run",
    text: "Invest from your wallet and rebalance on a schedule. Each trade waits for your signature.",
  },
];

const PROMISES = [
  { icon: <Wallet />, text: "Non-custodial: funds never leave your wallet" },
  { icon: <KeyRound />, text: "You sign every transaction yourself" },
  { icon: <ShieldCheck />, text: "API keys stay on the server, never in your browser" },
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
          <div className="h-[28rem] w-[56rem] max-w-full rounded-full bg-brand opacity-[0.14] blur-3xl dark:opacity-20" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-[size:48px_48px] opacity-60"
        />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pb-28">
          <div className="space-y-8">
            <Link
              href="/assistant"
              className="group inline-flex items-center gap-2 rounded-full border bg-surface/80 py-1 pr-3 pl-1 text-xs font-medium shadow-xs backdrop-blur transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-primary-foreground">
                <Sparkles className="size-3" aria-hidden /> New
              </span>
              AI research assistant, with every source shown
              <ArrowRight
                className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>

            <div className="space-y-5">
              <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Rule-based portfolios on Solana,{" "}
                <span className="text-brand">conducted by you.</span>
              </h1>
              <p className="max-w-xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg sm:leading-8">
                Orchestra turns an investing idea into a symphony: a strategy of assets, weights and
                rules you can backtest, then run from your own wallet across crypto and tokenized
                stocks.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/create">
                  Create a symphony <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/assistant">
                  <Bot /> Ask the assistant
                </Link>
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
              Everything in one place
            </p>
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              From idea to running strategy
            </h2>
            <p className="text-pretty text-muted-foreground">
              Design, test, research and trade without handing your keys to anyone.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <Link
                  href={feature.href}
                  className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-6 shadow-soft transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-brand group-hover:text-primary-foreground [&_svg]:size-5">
                    {feature.icon}
                  </span>
                  <span className="space-y-2">
                    <span className="block type-h3">{feature.title}</span>
                    <span className="block text-sm leading-6 text-muted-foreground">
                      {feature.text}
                    </span>
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-foreground">
                    {feature.cta}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
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
              Three steps, all in your control
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
              Compose your first symphony
            </h2>
            <p className="text-pretty text-white/85">
              Start from a template like a SOL trend follower or a momentum top 3, then make it your
              own. Drafts save automatically.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="bg-white text-[oklch(0.3_0.12_285)] hover:bg-white/90"
              >
                <Link href="/create">
                  Open the editor <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-white ring-1 ring-white/40 hover:bg-white/10 hover:text-white"
              >
                <Link href="/symphonies">See example symphonies</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/** A static illustration of a symphony and its allocation (decorative, not live data). */
function HeroPreview() {
  const bars = [
    { label: "SOL", pct: 60 },
    { label: "JUP", pct: 25 },
    { label: "USDC", pct: 15 },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-brand opacity-20 blur-2xl" />
      <div className="rounded-2xl border bg-card/90 p-5 shadow-lift backdrop-blur sm:p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-primary-foreground">
              <GitBranch className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">SOL trend follower</p>
              <p className="type-caption">Example symphony</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
            <Check className="size-3" /> Valid
          </span>
        </div>

        <div className="space-y-3 py-4 text-sm">
          <div className="rounded-lg bg-surface-raised p-3 font-medium">
            If <Chip>SOL</Chip> price <span className="text-muted-foreground">&gt;</span>{" "}
            <Chip>SOL</Chip> 50-day average
          </div>
          <div className="space-y-2 border-l-2 pl-4">
            <span className="inline-flex h-5 items-center rounded-full bg-success/12 px-2 text-[0.6875rem] font-semibold text-success uppercase">
              Then
            </span>
            <div className="rounded-lg border bg-surface p-3">
              <Chip>SOL</Chip> 60% · <Chip>JUP</Chip> 25% · <Chip>USDC</Chip> 15%
            </div>
            <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[0.6875rem] font-semibold text-muted-foreground uppercase">
              Else
            </span>
            <div className="rounded-lg border bg-surface p-3">
              <Chip>USDC</Chip>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Allocation today
          </p>
          {bars.map((bar) => (
            <div key={bar.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{bar.label}</span>
                <span className="text-muted-foreground tabular-nums">{bar.pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${bar.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center rounded-md border bg-surface px-1.5 py-0.5 text-xs font-semibold">
      {children}
    </span>
  );
}

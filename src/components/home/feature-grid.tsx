import {
  Activity,
  MousePointerClick,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Reveal } from "@/components/motion";
import { cn } from "@/lib/utils";

import { DitherField } from "./dither-field";

type Card = {
  label: string;
  title: string;
  text: string;
  icon: LucideIcon;
  /** Grid placement on large screens (a 3-column bento). */
  span: string;
  art: ReactNode;
};

const CARDS: Card[] = [
  {
    label: "Custody",
    title: "Non-custodial by design",
    text: "Your funds never leave your wallet.",
    icon: ShieldCheck,
    span: "lg:col-span-2",
    art: <DitherField className="opacity-60" speed="90s" />,
  },
  {
    label: "Data",
    title: "Live data",
    text: "Research built on live market sources.",
    icon: Activity,
    span: "lg:col-span-1",
    art: <Lines />,
  },
  {
    label: "Risk",
    title: "Clear warnings",
    text: "Know when conditions aren't in your favour.",
    icon: TriangleAlert,
    span: "lg:col-span-1",
    art: <Rings />,
  },
  {
    label: "Trading",
    title: "Simple trades",
    text: "Buy with USDC in a few clicks.",
    icon: MousePointerClick,
    span: "lg:col-span-2",
    art: <Steps />,
  },
];

/** "Everything you need": four bordered cards in a bento grid, each with a small abstract graphic. */
export function FeatureGrid() {
  return (
    <section id="product" aria-labelledby="features-heading" className="scroll-mt-20 border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <h2
            id="features-heading"
            className="mx-auto max-w-2xl text-center text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl"
          >
            Everything you need to <em className="font-normal italic">invest with clarity</em>
          </h2>
        </Reveal>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card, i) => (
            <Reveal
              as="li"
              key={card.title}
              delay={i * 0.06}
              className={cn(
                "group relative flex min-h-64 card-lift flex-col overflow-hidden rounded-2xl border bg-card",
                card.span,
              )}
            >
              <div className="relative h-32 overflow-hidden border-b sm:h-36">{card.art}</div>
              <div className="flex flex-1 flex-col gap-1.5 p-5 sm:p-6">
                <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  <card.icon className="size-3.5 text-primary-text" aria-hidden />
                  {card.label}
                </p>
                <h3 className="text-lg font-semibold tracking-tight">{card.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{card.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Thin layered lines, like a calm signal. */
function Lines() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 120"
      preserveAspectRatio="none"
      className="absolute inset-0 size-full"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M0 ${70 + i * 8} C 60 ${40 + i * 10}, 110 ${95 - i * 6}, 170 ${60 + i * 5} S 260 ${30 + i * 9}, 300 ${50 + i * 6}`}
          fill="none"
          stroke={i === 2 ? "var(--primary)" : "var(--muted-foreground)"}
          strokeOpacity={i === 2 ? 1 : 0.25}
          strokeWidth={i === 2 ? 2 : 1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/** Concentric rings with one navy marker. */
function Rings() {
  return (
    <svg aria-hidden viewBox="0 0 300 140" className="absolute inset-0 size-full">
      {[18, 36, 54, 72, 90].map((r) => (
        <circle
          key={r}
          cx="150"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeOpacity={0.25}
        />
      ))}
      <circle cx="150" cy="70" r="7" fill="var(--primary)" />
      <circle
        cx="201"
        cy="45"
        r="5"
        fill="var(--background)"
        stroke="var(--primary)"
        strokeWidth="2"
      />
    </svg>
  );
}

/** Three steps along a line, the last one filled. */
function Steps() {
  return (
    <svg aria-hidden viewBox="0 0 600 140" className="absolute inset-0 size-full">
      <line x1="90" y1="70" x2="510" y2="70" stroke="var(--border)" strokeWidth="2" />
      <line x1="90" y1="70" x2="300" y2="70" stroke="var(--primary)" strokeWidth="2" />
      {[90, 300, 510].map((x, i) => (
        <g key={x}>
          <rect
            x={x - 26}
            y="44"
            width="52"
            height="52"
            rx="14"
            fill={i < 2 ? "var(--primary)" : "var(--background)"}
            stroke="var(--primary)"
            strokeWidth="2"
          />
          <circle cx={x} cy="70" r="5" fill={i < 2 ? "var(--background)" : "var(--primary)"} />
        </g>
      ))}
    </svg>
  );
}

import { Activity, CircleDollarSign, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";

import { Reveal } from "@/components/motion";
import { cn } from "@/lib/utils";

import { GradientCard, HomeGradients } from "./effects";

// A wide card across the top, then three below (on tablets the last one spans both columns).
const CARDS: { title: string; text: string; icon: LucideIcon; wide?: boolean; span?: string }[] = [
  {
    title: "Non-custodial",
    text: "Your funds never leave your wallet.",
    icon: Wallet,
    wide: true,
  },
  { title: "Live data", text: "Answers grounded in live market sources.", icon: Activity },
  {
    title: "Honest warnings",
    text: "Know when markets are closed or spreads are wide.",
    icon: TriangleAlert,
  },
  {
    title: "Simple trades",
    text: "Buy with USDC. Tiny SOL network fees.",
    icon: CircleDollarSign,
    span: "sm:col-span-2 lg:col-span-1",
  },
];

/** "Built for investors who think first": four gradient-bordered cards, the first one wide with a graphic. */
export function BentoGrid() {
  return (
    <section
      id="product"
      aria-labelledby="bento-heading"
      className="relative scroll-mt-20 border-t"
    >
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <Reveal>
          <h2
            id="bento-heading"
            className="mx-auto max-w-2xl text-center text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl"
          >
            Built for investors who{" "}
            <em className="text-gradient-silver pr-[0.06em] font-semibold italic">think first</em>
          </h2>
        </Reveal>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card, i) => (
            <Reveal
              as="li"
              key={card.title}
              delay={i * 0.06}
              className={cn(card.wide && "sm:col-span-2 lg:col-span-3", card.span)}
            >
              <GradientCard
                className="h-full"
                innerClassName={cn("flex h-full flex-col", card.wide && "md:flex-row")}
              >
                <div className="relative z-10 flex flex-1 flex-col gap-3 p-6 sm:p-7">
                  <span className="flex size-10 items-center justify-center rounded-full border border-[rgb(143_164_255/0.35)] bg-[radial-gradient(circle,rgb(59_91_219/0.35),rgb(15_27_45/0.6))] shadow-[0_0_24px_-4px_rgb(59_91_219/0.6)]">
                    <card.icon className="size-4.5 text-foreground" aria-hidden />
                  </span>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">{card.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{card.text}</p>
                </div>
                {card.wide && (
                  <div className="relative min-h-40 flex-1 border-t md:border-t-0 md:border-l">
                    <Vault />
                  </div>
                )}
              </GradientCard>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The wide card's graphic: nested rounded squares (a vault) with a glowing core. */
function Vault() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
    >
      <HomeGradients id="vault" />
      <circle cx="160" cy="100" r="110" fill="url(#vault-glow)" />
      {[0, 1, 2, 3].map((i) => {
        const s = 150 - i * 34;
        return (
          <rect
            key={i}
            x={160 - s / 2}
            y={100 - s / 2}
            width={s}
            height={s}
            rx={26 - i * 4}
            fill="none"
            stroke="url(#vault-silver)"
            strokeOpacity={0.25 + i * 0.18}
            transform={`rotate(${i * 8} 160 100)`}
          />
        );
      })}
      <circle cx="160" cy="100" r="10" fill="#F5F7FA" />
    </svg>
  );
}

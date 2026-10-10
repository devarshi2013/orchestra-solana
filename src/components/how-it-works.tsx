"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Check, MessageSquare, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * "How it works" on the home page: three steps on the left, a live preview of
 * the active step on the right. Steps auto-advance every 4 s on desktop
 * (paused on hover or keyboard focus, off-screen, and under reduced motion);
 * on mobile each step shows its own preview, with no auto-advance.
 *
 * Every preview is a static demo: example data only, no live prices or calls.
 */

type Step = {
  title: string;
  text: string;
  icon: LucideIcon;
  /** What the preview shows, for screen readers (the mock itself is decorative). */
  summary: string;
  Preview: (props: { animate: boolean }) => ReactNode;
};

const ADVANCE_MS = 4000;
const WORD_MS = 70;
const EASE = [0.22, 1, 0.36, 1] as const;

const QUESTION = "How has AAPL performed this month?";
const REPLY =
  "In this example, AAPL is up about 4% over the past month, with most of the move after its earnings report. Short-term moves can reverse, so it's worth looking at the longer trend too.";

const STEPS: Step[] = [
  {
    title: "Connect your wallet",
    text: "Link your own wallet. We never hold your funds.",
    icon: Wallet,
    summary: "Example: a wallet shown as connected, with a shortened address.",
    Preview: WalletPreview,
  },
  {
    title: "Ask the AI",
    text: "Ask anything about tokenized US stocks, like prices, trends, or what a token represents.",
    icon: MessageSquare,
    summary: `Example chat. You ask: "${QUESTION}" The AI replies: "${REPLY}"`,
    Preview: ChatPreview,
  },
  {
    title: "Approve in your wallet",
    text: "Review the trade details and sign it yourself. Nothing happens without your approval.",
    icon: ShieldCheck,
    summary:
      "Example wallet confirmation: pay 100 USDC, receive about 0.43 AAPLx, estimated fee about 0.00001 SOL, with Reject and Approve buttons.",
    Preview: ApprovePreview,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 border-t">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl space-y-3">
          <h2 id="how-heading" className="text-3xl font-semibold tracking-tight">
            How it works
          </h2>
          <p className="text-base text-muted-foreground">
            From question to trade in three steps. You stay in control the whole way.
          </p>
        </div>
        <DesktopSteps />
        <MobileSteps />
      </div>
    </section>
  );
}

// --- Desktop: steps + one preview -------------------------------------------

const DESKTOP = "(min-width: 768px)";
/** Whether the two-column layout is showing (no auto-advance on mobile). */
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

function DesktopSteps() {
  const reduce = useReducedMotion() ?? false;
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.4 });
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const desktop = useIsDesktop();
  // Bumped on every click so the 4 s timer restarts from the chosen step.
  const [tick, setTick] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const auto = desktop && !reduce && inView && !hovered && !focused;
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % STEPS.length), ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [auto, active, tick]);

  const choose = (i: number) => {
    setActive(i);
    setTick((t) => t + 1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? (i + 1) % STEPS.length
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? (i - 1 + STEPS.length) % STEPS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? STEPS.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    choose(next);
    tabs.current[next]?.focus();
  };

  const step = STEPS[active] ?? STEPS[0]!;
  return (
    <div
      ref={root}
      className="mt-12 hidden gap-12 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div role="tablist" aria-orientation="vertical" aria-label="Steps" className="relative">
        {STEPS.map((s, i) => {
          const on = i === active;
          return (
            <div key={s.title} className="relative flex gap-5 pb-10 last:pb-0">
              {/* The line to the next step: gray, filled navy once that step is reached. */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-12 bottom-1 left-[1.1875rem] w-px overflow-hidden bg-border"
                >
                  <span
                    className={cn(
                      "block size-full origin-top bg-primary transition-transform duration-500 ease-out",
                      i < active ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                </span>
              )}
              <button
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`how-tab-${i}`}
                aria-selected={on}
                aria-controls="how-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => choose(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className="group flex w-full gap-5 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <span
                  className={cn(
                    "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors duration-300",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : i < active
                        ? "border-primary bg-background text-primary-text"
                        : "border-border bg-background text-muted-foreground group-hover:border-primary/40",
                  )}
                >
                  {i + 1}
                </span>
                <span className="space-y-1.5 pt-1.5">
                  <span
                    className={cn(
                      "flex items-center gap-2 text-lg transition-colors duration-300",
                      on
                        ? "font-semibold text-foreground"
                        : "font-medium text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <s.icon className="size-4.5" aria-hidden />
                    {s.title}
                  </span>
                  <span
                    className={cn(
                      "block max-w-sm text-sm leading-6 transition-colors duration-300",
                      on ? "text-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {s.text}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <div
          id="how-panel"
          role="tabpanel"
          aria-labelledby={`how-tab-${active}`}
          className="relative grid min-h-[22rem] place-items-center overflow-hidden rounded-2xl border bg-card p-6 lg:p-10"
        >
          <p className="sr-only">{step.summary}</p>
          <AnimatePresence initial={false}>
            <motion.div
              key={active}
              aria-hidden
              // All previews share one grid cell, so the old one fades out as the new one fades in.
              className="w-full max-w-sm [grid-area:1/1]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <step.Preview animate={!reduce} />
            </motion.div>
          </AnimatePresence>
        </div>
        <Caption />
      </div>
    </div>
  );
}

// --- Mobile: each step with its own preview ---------------------------------

function MobileSteps() {
  return (
    <div className="mt-10 md:hidden">
      <ol className="space-y-10">
        {STEPS.map((s, i) => (
          <li key={s.title} className="space-y-4">
            <div className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                {i + 1}
              </span>
              <div className="space-y-1 pt-1">
                <h3 className="flex items-center gap-2 font-sans text-base font-semibold text-foreground">
                  <s.icon className="size-4" aria-hidden />
                  {s.title}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">{s.text}</p>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="sr-only">{s.summary}</p>
              <div aria-hidden>
                <s.Preview animate={false} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <Caption />
    </div>
  );
}

function Caption() {
  return <p className="mt-3 text-xs text-muted-foreground">Example only. Not financial advice.</p>;
}

// --- The previews (decorative mock-ups) -------------------------------------

function WalletPreview() {
  return (
    <div className="space-y-4 rounded-xl border bg-background p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </span>
          Your wallet
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-tint px-2.5 py-0.5 text-xs font-medium text-primary-text">
          <Check className="size-3" />
          Connected
        </span>
      </div>
      <div className="rounded-lg border bg-card px-3 py-2.5">
        <p className="text-xs text-muted-foreground">Address</p>
        <p className="font-mono text-sm">7a3K…f91c</p>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Network</span>
        <span className="font-medium">Solana</span>
      </div>
      <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Your keys stay in your wallet.
      </p>
    </div>
  );
}

function ChatPreview({ animate }: { animate: boolean }) {
  const words = REPLY.split(" ");
  const [shown, setShown] = useState(animate ? 0 : words.length);
  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => setShown((n) => (n >= words.length ? n : n + 1)), WORD_MS);
    return () => window.clearInterval(id);
  }, [animate, words.length]);
  const typing = shown < words.length;

  return (
    <div className="overflow-hidden rounded-xl border bg-background shadow-soft">
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">
        <MessageSquare className="size-3.5" />
        Quill chat
      </div>
      <div className="space-y-3 p-4">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {QUESTION}
        </p>
        <div className="flex gap-2">
          <LogoMark className="mt-0.5 size-6" />
          <p className="min-h-[7.5rem] flex-1 rounded-2xl rounded-tl-md border bg-card px-3.5 py-2 text-sm leading-6">
            {words.slice(0, shown).join(" ")}
            {typing && (
              <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function ApprovePreview() {
  const rows = [
    ["You pay", "100.00 USDC"],
    ["You receive", "≈ 0.43 AAPLx"],
    ["Estimated fee", "≈ 0.00001 SOL"],
  ];
  return (
    <div className="space-y-4 rounded-xl border bg-background p-5 shadow-lift">
      <div className="space-y-1 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary-tint text-primary-text">
          <ShieldCheck className="size-5" />
        </span>
        <p className="pt-1 text-sm font-semibold">Approve transaction</p>
        <p className="text-xs text-muted-foreground">quill · swap via Jupiter</p>
      </div>
      <dl className="divide-y rounded-lg border bg-card text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-2 gap-2">
        <span className="inline-flex h-10 items-center justify-center rounded-lg border border-primary bg-secondary text-sm font-medium text-secondary-foreground">
          Reject
        </span>
        <span className="inline-flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
          Approve
        </span>
      </div>
    </div>
  );
}

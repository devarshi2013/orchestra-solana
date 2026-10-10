"use client";

import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { scrollPageTo } from "@/lib/smooth-scroll";
import { cn } from "@/lib/utils";

import { usePrefersReducedMotion } from "../feature-visuals/visual-frame";
import { useStoryData, type StoryData } from "./story-data";
import { describeScreen, Screen } from "./story-screens";

const STEPS = [
  { title: "Ask", text: "Say what you want in plain words." },
  { title: "Research", text: "Quill ranks real stocks with live data you can check." },
  { title: "Quote", text: "Each item gets a live Jupiter quote: fees, price impact, route." },
  { title: "Approve", text: "Nothing moves until you approve it in your own wallet." },
  { title: "Own", text: "The tokens land in your wallet. They're yours." },
];
const LAST = STEPS.length - 1;
/** No scrolling for this long while the section is on screen: the steps advance by themselves. */
const IDLE_MS = 6000;
const AUTO_MS = 3800;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Watch one trade happen": a sticky walkthrough. A rail of five steps on the
 * left (a top progress bar on phones) and ONE device frame on the right whose
 * screen changes as you scroll (about 70vh a step). Clicking a step scrolls to
 * it; after 6 s without scrolling the steps advance on their own (paused on
 * hover). Under reduced motion there's no scroll-driving: the five screens are
 * a static row you can scroll sideways.
 */
export function ScrollStory() {
  const reduce = usePrefersReducedMotion();
  const sticky = useRef<HTMLDivElement>(null);
  const inView = useInView(sticky, { amount: 0.5 });
  const data = useStoryData(inView);
  return reduce ? (
    <StaticStory data={data} />
  ) : (
    <LiveStory data={data} sticky={sticky} inView={inView} />
  );
}

function LiveStory({
  data,
  sticky,
  inView,
}: {
  data: StoryData;
  sticky: React.RefObject<HTMLDivElement | null>;
  inView: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  // 0 when the track reaches the sticky position, 1 when it's about to leave.
  const { scrollYProgress } = useScroll({ target: track, offset: ["start 96px", "end end"] });
  const [scrollStep, setScrollStep] = useState(0);
  const [autoStep, setAutoStep] = useState<number | null>(null);
  const lastScroll = useRef(0);
  const hovered = useRef(false);
  // The scroll step again, readable from the auto-play timer.
  const scrollStepRef = useRef(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    lastScroll.current = Date.now();
    setAutoStep(null);
    const next = Math.min(LAST, Math.max(0, Math.floor(v * STEPS.length)));
    scrollStepRef.current = next;
    setScrollStep(next);
  });

  // Auto-play: once nothing has scrolled for 6 s, advance every few seconds (not while hovered).
  useEffect(() => {
    if (!inView) return;
    lastScroll.current = Date.now();
    const id = window.setInterval(() => {
      if (hovered.current || document.visibilityState !== "visible") return;
      if (Date.now() - lastScroll.current < IDLE_MS) return;
      setAutoStep((current) => ((current ?? scrollStepRef.current) + 1) % STEPS.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [inView]);

  const step = autoStep ?? scrollStep;

  /** Scrolls so that step `i` is the active one. */
  const jump = (i: number) => {
    const el = track.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    const distance = el.offsetHeight - window.innerHeight + 96;
    setAutoStep(null);
    scrollPageTo(top + ((i + 0.5) / STEPS.length) * distance);
  };

  return (
    // Tall on purpose: five steps of ~70vh each, plus the sticky area itself.
    <div ref={track} className="relative mt-12 h-[calc(350vh+100vh-7rem)] sm:mt-16">
      <div
        ref={sticky}
        onPointerEnter={() => (hovered.current = true)}
        onPointerLeave={() => (hovered.current = false)}
        className="sticky top-24 flex h-[calc(100dvh-7rem)] flex-col gap-4 md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-center md:gap-12 lg:gap-20"
      >
        {/* Phones: a compact progress bar above the frame. */}
        <ol className="flex items-center gap-1.5 md:hidden" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex-1">
              <button
                type="button"
                onClick={() => jump(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`Step ${i + 1} of ${STEPS.length}: ${s.title}`}
                className="block h-6 w-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "block h-1 rounded-full transition-colors duration-300",
                    i <= step ? "bg-[var(--label-blue)]" : "bg-surface-raised",
                  )}
                />
              </button>
            </li>
          ))}
          <li
            aria-hidden
            className="shrink-0 pl-1 font-mono text-xs text-muted-foreground tabular-nums"
          >
            {step + 1}/{STEPS.length}
          </li>
        </ol>

        {/* Desktop: the rail. The line fills as you scroll; done steps get a check. */}
        <ol className="relative hidden md:block" aria-label="Steps">
          <span aria-hidden className="absolute top-5 bottom-5 left-[1.1875rem] w-px bg-border" />
          <motion.span
            aria-hidden
            style={{
              scaleY: autoStep === null ? scrollYProgress : (autoStep + 0.5) / STEPS.length,
            }}
            className={cn(
              "absolute top-5 bottom-5 left-[1.1875rem] w-px origin-top bg-[linear-gradient(180deg,#C9D0D7,#3B5BDB)] will-change-transform",
              // Scroll drives it directly; only the auto-play steps ease.
              autoStep !== null && "transition-transform duration-300 ease-out",
            )}
          />
          {STEPS.map((s, i) => {
            const state = i === step ? "active" : i < step ? "done" : "todo";
            return (
              <li key={s.title} className="relative pb-7 last:pb-0">
                <button
                  type="button"
                  onClick={() => jump(i)}
                  aria-current={state === "active" ? "step" : undefined}
                  className="group flex w-full items-start gap-4 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-medium transition-colors duration-300",
                      state === "active" &&
                        "border-[rgb(143_164_255/0.6)] bg-[rgb(30_58_138/0.9)] text-foreground shadow-[0_0_24px_-2px_rgb(59_91_219/0.75)]",
                      state === "done" &&
                        "border-[rgb(143_164_255/0.4)] bg-card text-[var(--label-blue)]",
                      state === "todo" &&
                        "bg-card text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {state === "done" ? <Check className="size-4" aria-label="Done" /> : i + 1}
                  </span>
                  <span className="pt-1.5">
                    <span
                      className={cn(
                        "block font-heading text-lg font-semibold tracking-tight transition-colors duration-300",
                        state === "active"
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {s.title}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block max-w-xs text-sm leading-6 transition-opacity duration-300",
                        state === "active"
                          ? "text-muted-foreground opacity-100"
                          : "text-muted-foreground opacity-60",
                      )}
                    >
                      {s.text}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex min-h-0 flex-1 flex-col gap-4 md:block md:flex-none">
          <DeviceFrame>
            <p className="sr-only" aria-live="polite">
              {describeScreen(step, data)}
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                aria-hidden
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="h-full"
              >
                <Screen step={step} data={data} instant={false} />
              </motion.div>
            </AnimatePresence>
          </DeviceFrame>
          {/* Phones: the active step's copy sits under the frame. */}
          <div className="md:hidden" aria-hidden>
            <p className="font-heading text-lg font-semibold tracking-tight">
              {STEPS[step]!.title}
            </p>
            <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{STEPS[step]!.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Reduced motion: the five screens side by side, each in its final state, scrollable sideways. */
function StaticStory({ data }: { data: StoryData }) {
  return (
    <ol
      tabIndex={0}
      aria-label="The five steps"
      className="mt-12 flex snap-x gap-4 overflow-x-auto rounded-xl pb-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mt-16"
    >
      {STEPS.map((s, i) => (
        <li key={s.title} className="w-[19rem] shrink-0 snap-start space-y-3 sm:w-[22rem]">
          <DeviceFrame fixed>
            <p className="sr-only">{describeScreen(i, data)}</p>
            <div aria-hidden className="h-full">
              <Screen step={i} data={data} instant />
            </div>
          </DeviceFrame>
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight">
              <span className="mr-2 font-mono text-sm text-muted-foreground">{i + 1}/5</span>
              {s.title}
            </p>
            <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The device the screens play in: a phone on small screens (rounded bezel and
 * notch), an app window on larger ones (title bar with dots). `fixed` gives it
 * a set height (the static row); otherwise it fills what the sticky area allows.
 */
function DeviceFrame({ children, fixed = false }: { children: React.ReactNode; fixed?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[21rem] flex-col overflow-hidden rounded-[2rem] border-2 border-[rgb(255_255_255/0.14)] bg-card shadow-lift md:max-w-none md:rounded-2xl md:border",
        fixed
          ? "h-[27rem]"
          : "min-h-0 flex-1 md:h-[30rem] md:max-h-[calc(100dvh-10rem)] md:flex-none",
      )}
    >
      <div
        aria-hidden
        className="flex h-8 shrink-0 items-center justify-center border-b md:justify-start md:gap-1.5 md:px-4"
      >
        <span className="h-1.5 w-14 rounded-full bg-surface-raised md:hidden" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="hidden size-2 rounded-full bg-surface-raised md:block" />
        ))}
        <span className="ml-2 hidden font-mono text-[0.625rem] text-muted-foreground md:block">
          Quill
        </span>
      </div>
      <div className="relative min-h-0 flex-1 p-3 sm:p-4">{children}</div>
    </div>
  );
}

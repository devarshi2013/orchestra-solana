import { Reveal } from "@/components/motion";

/**
 * The large centred statement after the hero. Hovering it spreads the letters
 * a touch and fades in a soft blue glow behind (globals.css, .statement-hover).
 */
export function Statement() {
  return (
    <section aria-labelledby="statement-heading" className="relative">
      <div className="mx-auto max-w-6xl px-4 py-28 text-center sm:px-6 sm:py-40">
        <Reveal>
          <h2
            id="statement-heading"
            className="statement-hover relative mx-auto max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight sm:text-7xl md:text-8xl"
          >
            <span
              aria-hidden
              className="statement-glow pointer-events-none absolute inset-x-[10%] inset-y-0 -z-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(59_91_219/0.35),transparent_70%)] opacity-0 blur-2xl"
            />
            Clarity is the best edge.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Quill turns market noise into answers you can understand.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

import { Reveal } from "@/components/motion";

/** The large centred statement after the hero. */
export function Statement() {
  return (
    <section aria-labelledby="statement-heading" className="relative border-t">
      <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <Reveal>
          <h2
            id="statement-heading"
            className="mx-auto max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight sm:text-7xl md:text-8xl"
          >
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

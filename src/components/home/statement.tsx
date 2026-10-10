import { Reveal } from "@/components/motion";

/** The large centred statement between the hero and the feature rows. */
export function Statement() {
  return (
    <section aria-labelledby="statement-heading" className="border-t">
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24">
        <Reveal>
          <h2
            id="statement-heading"
            className="mx-auto max-w-3xl text-center text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl md:text-6xl"
          >
            Smarter decisions start here
          </h2>
        </Reveal>
      </div>
    </section>
  );
}

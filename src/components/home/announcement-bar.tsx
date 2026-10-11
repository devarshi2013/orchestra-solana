import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** The thin strip at the very top of the home page, with a blue gradient line under it. */
export function AnnouncementBar() {
  return (
    <div className="relative">
      <Link
        href="/chat"
        className="group mx-auto flex min-h-9 max-w-6xl items-center justify-center gap-1.5 px-4 py-2 text-center text-xs font-medium text-foreground/90 outline-none hover:text-foreground focus-visible:underline sm:text-[0.8125rem]"
      >
        Quill is live. Research first, trade on your terms
        <ArrowRight
          className="size-3.5 shrink-0 transition-transform duration-300 motion-safe:group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
      <div
        aria-hidden
        className="h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--glow-blue)_70%,transparent),color-mix(in_srgb,var(--silver)_40%,transparent),color-mix(in_srgb,var(--glow-blue)_70%,transparent),transparent)]"
      />
    </div>
  );
}

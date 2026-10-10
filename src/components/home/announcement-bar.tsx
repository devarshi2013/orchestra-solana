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
        className="h-px bg-[linear-gradient(90deg,transparent,rgb(59_91_219/0.7),rgb(201_208_215/0.4),rgb(59_91_219/0.7),transparent)]"
      />
    </div>
  );
}

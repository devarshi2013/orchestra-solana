import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** The thin navy strip at the very top of the home page, linking into the app. */
export function AnnouncementBar() {
  return (
    <div className="theme-navy">
      <Link
        href="/chat"
        className="group mx-auto flex min-h-9 max-w-6xl items-center justify-center gap-1.5 px-4 py-2 text-center text-xs font-medium outline-none focus-visible:underline sm:text-[0.8125rem]"
      >
        Quill is live. Research smarter, trade on your terms
        <ArrowRight
          className="size-3.5 shrink-0 transition-transform duration-300 motion-safe:group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </div>
  );
}

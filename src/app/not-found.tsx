import type { Metadata } from "next";
import Link from "next/link";

import { TickertapeMark } from "@/components/brand/tickertape-mark";

export const metadata: Metadata = { title: "Page not found" };

const PILL =
  "inline-flex h-11 items-center justify-center rounded-full px-5 text-[length:var(--text-button-md)] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.98]";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 pt-36 pb-24 text-center">
      <TickertapeMark className="h-12 text-text-extra-high" />
      <p className="text-body-md mt-6 text-text-low tabular-nums">404</p>
      <h1 className="text-title-lg mt-1 text-text-extra-high">Page not found</h1>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={`${PILL} bg-text-extra-high text-background hover:bg-text-high`}>
          Home
        </Link>
      </div>
    </main>
  );
}

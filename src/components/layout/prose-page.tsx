import type { ReactNode } from "react";

/** A reading page (terms, risk disclosure) in tokens.xyz's type: one narrow column under the header. */
export function ProsePage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-36 pb-24">
      <p className="text-[12px] font-semibold tracking-[0.08em] text-text-low uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-[44px] leading-[1.02] font-medium text-balance text-text-extra-high">
        {title}
      </h1>
      <p className="text-body-md mt-4 text-text-low">Last updated {updated}</p>
      <div className="[&_h2]:text-title-sm mt-12 space-y-10 text-[15px] leading-[1.6] text-text-high [&_a]:link-inline [&_h2]:mb-3 [&_h2]:text-text-extra-high [&_li]:ml-5 [&_li]:list-disc [&_li]:marker:text-text-extra-low [&_ul]:space-y-1.5">
        {children}
      </div>
    </main>
  );
}

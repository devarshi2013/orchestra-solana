import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { REGISTRY, STOCKS } from "@/lib/stocks/registry";
import { ISSUER_NAMES } from "@/lib/stocks/types";

export const metadata: Metadata = {
  title: "Stock registry",
  description:
    "Every tokenized stock Quill lists: its token, issuer, mint address and when it was last verified.",
};

const short = (mint: string) => `${mint.slice(0, 4)}…${mint.slice(-4)}`;

/**
 * /registry: every token Quill can show or trade, straight from the verified
 * registry (the only source of mints in the app): company, token, issuer, the
 * mint with a Solscan link, and when the registry was last verified.
 */
export default function RegistryPage() {
  const verified = new Date(REGISTRY.syncedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const rows = [...STOCKS].sort(
    (a, b) => a.ticker.localeCompare(b.ticker) || a.symbol.localeCompare(b.symbol),
  );
  const companies = new Set(STOCKS.map((s) => s.ticker)).size;
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Stock registry</h1>
        <p className="max-w-2xl text-muted-foreground">
          {companies} companies and funds, {STOCKS.length} tokens. Each token comes from its
          issuer&apos;s official list and was checked on Jupiter. Last verified{" "}
          <span className="font-mono text-foreground">{verified}</span>.
        </p>
      </header>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Token</th>
              <th className="px-4 py-3 font-medium">Issuer</th>
              <th className="px-4 py-3 font-medium">Mint</th>
              <th className="px-4 py-3 text-right font-medium">Last verified</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.mint} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium">{s.companyName}</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{s.ticker}</span>
                </td>
                <td className="px-4 py-2.5 font-mono">{s.symbol}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{ISSUER_NAMES[s.issuer]}</td>
                <td className="px-4 py-2.5">
                  <a
                    href={`https://solscan.io/token/${s.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.mint}
                    className="inline-flex items-center gap-1 font-mono text-[var(--label-blue)] outline-none hover:underline focus-visible:underline"
                  >
                    {short(s.mint)} <ExternalLink className="size-3" aria-label="on Solscan" />
                  </a>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                  {verified}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-12 text-center text-xs text-muted-foreground">
        Research only. Not financial advice.
      </p>
    </main>
  );
}

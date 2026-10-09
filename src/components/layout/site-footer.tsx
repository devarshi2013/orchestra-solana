import Link from "next/link";

const LINKS = [{ href: "/assistant", label: "Assistant" }];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Orchestra</p>
          <p className="max-w-md type-caption">
            Non-custodial: your wallet approves every swap, and Orchestra never holds funds.
            Tokenized stocks are securities with eligibility rules. Research, not financial advice.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

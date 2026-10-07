"use client";

import { Scale, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { investApi } from "@/lib/api-client";

type Notices = Awaited<ReturnType<typeof investApi.notifications>>;

/**
 * In-app banner for a signed-in wallet: rebalances that are due, and ones
 * that stopped partway. Silent when signed out.
 */
export function RebalanceBanner() {
  const pathname = usePathname();
  const [notices, setNotices] = useState<Notices | null>(null);

  useEffect(() => {
    investApi
      .notifications()
      .then(setNotices)
      .catch(() => setNotices(null));
  }, [pathname]);

  if (!notices) return null;
  const partial = notices.partial.filter(
    (p) => !pathname.startsWith(`/invest/${p.investmentId}/rebalance`),
  );
  const due = notices.notifications.filter(
    (n) => !n.investmentId || !pathname.startsWith(`/invest/${n.investmentId}/rebalance`),
  );
  if (partial.length === 0 && due.length === 0) return null;

  return (
    <div
      className="border-b bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-2 text-sm">
        {partial.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <Scale className="size-4 shrink-0" />
            <span className="flex-1">A rebalance of {p.investment.name} stopped partway.</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/invest/${p.investmentId}/rebalance`}>Resume</Link>
            </Button>
          </div>
        ))}
        {due.map((n) => (
          <div key={n.id} className="flex items-center gap-2">
            <Scale className="size-4 shrink-0" />
            <span className="flex-1">
              <span className="font-medium">{n.title}.</span> {n.body}
            </span>
            <Button asChild size="sm">
              <Link href={n.investmentId ? `/invest/${n.investmentId}/rebalance` : "/invest"}>
                Review &amp; rebalance
              </Link>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Dismiss"
              onClick={async () => {
                await investApi.dismissNotification(n.id).catch(() => {});
                setNotices(
                  (s) => s && { ...s, notifications: s.notifications.filter((x) => x.id !== n.id) },
                );
              }}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { investApi } from "@/lib/api-client";
import { describeRule } from "@/lib/invest/schedule";
import type { InvestmentView } from "@/lib/invest/views";

export function InvestmentList() {
  const [investments, setInvestments] = useState<InvestmentView[] | null>(null);
  useEffect(() => {
    investApi
      .list()
      .then(setInvestments)
      .catch(() => setInvestments([]));
  }, []);
  if (!investments) return <Skeleton className="h-20 w-full" />;
  if (investments.length === 0) {
    return <p className="text-sm text-muted-foreground">No investments yet. Create one below.</p>;
  }
  return (
    <ul className="divide-y rounded-lg border">
      {investments.map((inv) => (
        <li key={inv.id}>
          <Link
            href={`/invest/${inv.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
          >
            <span className="font-medium">{inv.name}</span>
            <Badge variant="outline">{inv.status}</Badge>
            <span className="flex-1" />
            <span className="text-xs text-muted-foreground">{describeRule(inv.rebalance)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

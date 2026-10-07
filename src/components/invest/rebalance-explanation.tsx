"use client";

import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { investApi } from "@/lib/api-client";
import type { ConditionState, RebalanceExplanation } from "@/lib/symphony/explain";

type Loaded = RebalanceExplanation & { name: string; summary: string[] };

const value = (v: number | null) => (v === null ? "n/a" : Number(v.toPrecision(6)).toString());
const state = (s: ConditionState | null) =>
  !s
    ? "not checked"
    : `${s.result === null ? "undecided" : s.result ? "true" : "false"} (${s.left.ticker} ${s.left.indicator} ${value(s.left.value)}${
        typeof s.right === "number" ? ` vs ${s.right}` : ` vs ${value(s.right.value)}`
      })`;

/**
 * "Why these trades": what changed in the symphony's decisions since the last
 * rebalance and how far the wallet drifted (explainRebalance), with a short
 * AI summary written only from that data. The data stays visible under it.
 */
export function RebalanceExplanationCard({ investmentId }: { investmentId: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<{ text: string | null; reason: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await investApi.explanation(investmentId);
        if (cancelled) return;
        setData(loaded);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        return;
      }
      try {
        const written = await investApi.aiExplanation(investmentId);
        if (!cancelled) setAi(written);
      } catch {
        if (!cancelled) setAi({ text: null, reason: "The AI explanation couldn't be loaded." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [investmentId]);

  if (error) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Why these trades</CardTitle>
        <CardDescription>
          {data
            ? `Comparing the ${data.from ?? "earliest"} close (${
                data.since === "last_rebalance" ? "last rebalance" : "when you started it"
              }) with the latest, ${data.to ?? "today"}.`
            : "Working out what changed…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md bg-muted/50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" /> AI summary, written only from the data below; it can
            be wrong
          </p>
          {ai === null ? (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Writing a short explanation…
            </p>
          ) : ai.text ? (
            <p>{ai.text}</p>
          ) : (
            <p className="text-muted-foreground">{ai.reason}</p>
          )}
        </div>
        {data && (
          <>
            <ul className="list-disc space-y-1 pl-5">
              {data.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {data.conditions.length + data.filters.length > 0 && (
              <details className="group text-xs">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground select-none">
                  <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                  Every rule, then and now
                </summary>
                <table className="mt-2 w-full tabular-nums">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 font-medium">Rule</th>
                      <th className="py-1 font-medium">At {data.from ?? "start"}</th>
                      <th className="py-1 font-medium">At {data.to ?? "today"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.conditions.map((c) => (
                      <tr
                        key={c.path}
                        className={`border-t align-top ${c.changed ? "font-medium" : ""}`}
                      >
                        <td className="py-1 pr-2">{c.description}</td>
                        <td className="py-1 pr-2">{state(c.before)}</td>
                        <td className="py-1">{state(c.now)}</td>
                      </tr>
                    ))}
                    {data.filters.map((f) => (
                      <tr
                        key={f.path}
                        className={`border-t align-top ${f.changed ? "font-medium" : ""}`}
                      >
                        <td className="py-1 pr-2">{f.description}</td>
                        <td className="py-1 pr-2">{f.before?.join(", ") ?? "not checked"}</td>
                        <td className="py-1">{f.now?.join(", ") ?? "not checked"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

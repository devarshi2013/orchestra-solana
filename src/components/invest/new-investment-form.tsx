"use client";

import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchDraft, investApi } from "@/lib/api-client";
import type { RebalanceRule } from "@/lib/backtest/types";
import { EXAMPLE_SYMPHONIES } from "@/lib/symphony/examples";
import type { Symphony } from "@/lib/symphony/types";
import { validateSymphony } from "@/lib/symphony/validate";
import { useSymphonyEditor } from "@/stores/symphony-editor";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Source = { label: string; symphony: Symphony; draftId?: string };

/** Starts a live symphony from a /create draft or an example. */
export function NewInvestmentForm() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>(
    EXAMPLE_SYMPHONIES.map((s) => ({ label: `Example: ${s.name}`, symphony: s })),
  );
  const [selected, setSelected] = useState(0);
  const [rule, setRule] = useState<RebalanceRule["kind"]>("weekly");
  const [triggerDrift, setTriggerDrift] = useState("5");
  const [skipDrift, setSkipDrift] = useState("2");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Offer the draft from ?draft=<id>, else this browser's /create draft, first.
  useEffect(() => {
    void (async () => {
      const id = new URLSearchParams(window.location.search).get("draft");
      let draft: Source | null = null;
      if (id) {
        draft = await fetchDraft(id)
          .then((d) => ({
            label: `Your draft: ${d.symphony.name}`,
            symphony: d.symphony,
            draftId: d.id,
          }))
          .catch(() => null);
      }
      if (!draft) {
        await useSymphonyEditor.persist.rehydrate();
        const { symphony, draftId } = useSymphonyEditor.getState();
        if (draftId) draft = { label: `Your draft: ${symphony.name}`, symphony, draftId };
      }
      if (draft) setSources((s) => [draft!, ...s.filter((x) => !x.draftId)]);
    })();
  }, []);

  const source = sources[selected]!;
  const issues = useMemo(
    () => validateSymphony(source.symphony, { isKnownMint: () => true }),
    [source],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rebalance: RebalanceRule =
        rule === "threshold"
          ? { kind: "threshold", driftPct: Number(triggerDrift) }
          : { kind: rule };
      const investment = await investApi.create({
        symphony: source.symphony,
        sourceDraftId: source.draftId,
        rebalance,
        driftThresholdPct: Number(skipDrift),
        notifyEmail: email.trim() || null,
      });
      router.push(`/invest/${investment.id}/rebalance`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New investment</CardTitle>
        <CardDescription>
          Your wallet&apos;s holdings of the symphony&apos;s tokens (plus USDC) become its
          portfolio. The first rebalance funds it from what&apos;s there, usually USDC.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="source">Symphony</Label>
            <select
              id="source"
              className={selectClass}
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {sources.map((s, i) => (
                <option key={s.label} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
            {issues.length > 0 && (
              <p className="text-xs text-destructive">
                Fix this symphony in Create first: {issues.map((i) => i.message).join("; ")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule">Rebalance</Label>
            <select
              id="rule"
              className={selectClass}
              value={rule}
              onChange={(e) => setRule(e.target.value as RebalanceRule["kind"])}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Mondays)</option>
              <option value="monthly">Monthly (1st)</option>
              <option value="threshold">When drift exceeds…</option>
            </select>
          </div>
          {rule === "threshold" && (
            <div className="space-y-1.5">
              <Label htmlFor="trigger">Rebalance when any holding drifts (pts)</Label>
              <Input
                id="trigger"
                type="number"
                min="0.5"
                step="0.5"
                value={triggerDrift}
                onChange={(e) => setTriggerDrift(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="skip">Skip trades within (pts of target)</Label>
            <Input
              id="skip"
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={skipDrift}
              onChange={(e) => setSkipDrift(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email reminders (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || issues.length > 0}>
              <Rocket /> {busy ? "Creating…" : "Create and review first rebalance"}
            </Button>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { CheckCircle2, Loader2, Scale } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { selectClass } from "@/components/editor/indicator-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assistantApi } from "@/lib/api-client";
import { keepBalancedWeights } from "@/lib/assistant/keep-balanced";
import type { ExecutionView } from "@/lib/assistant/views";
import type { RebalanceRule } from "@/lib/backtest/types";

const SCHEDULES: { label: string; rule: RebalanceRule }[] = [
  { label: "Weekly", rule: { kind: "weekly" } },
  { label: "Monthly", rule: { kind: "monthly" } },
  { label: "Daily", rule: { kind: "daily" } },
  { label: "When any holding drifts 5 pts", rule: { kind: "threshold", driftPct: 5 } },
];

/**
 * After a plan is bought: offer to keep those assets at the plan's weights as
 * a live symphony on a schedule. Only created when the user clicks; its
 * rebalances are proposed, and every trade still needs their signature.
 */
export function KeepBalancedOffer({ execution }: { execution: ExecutionView }) {
  const weights = keepBalancedWeights(execution.items);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(
    () =>
      `AI plan · ${new Date(execution.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`,
  );
  const [schedule, setSchedule] = useState(0);
  const [drift, setDrift] = useState("2");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (weights.length === 0) return null;
  if (created) {
    return (
      <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
        <CheckCircle2 className="size-4 text-emerald-600" /> Saved as a live symphony.{" "}
        <Link href={`/invest/${created}`} className="text-primary hover:underline">
          View it
        </Link>
      </p>
    );
  }
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Scale /> Keep this balanced automatically
      </Button>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await assistantApi.keepBalanced(execution.id, {
        name: name.trim(),
        rebalance: SCHEDULES[schedule]!.rule,
        driftThresholdPct: Number(drift) || 0,
      });
      setCreated(result.investmentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <p className="font-medium">Keep this balanced automatically</p>
      <p className="text-xs text-muted-foreground">
        Saves what you bought as a symphony held at these weights. When a rebalance is due,
        Orchestra lets you know and shows the trades; nothing trades until you sign each one.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
        {weights.map((w) => (
          <li key={w.symbol}>
            <span className="font-medium">{w.symbol}</span> {w.percent}%
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Rebalance</span>
          <select
            className={selectClass + " w-full"}
            value={schedule}
            onChange={(e) => setSchedule(Number(e.target.value))}
          >
            {SCHEDULES.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Skip trades within (pts)</span>
          <Input
            inputMode="decimal"
            value={drift}
            onChange={(e) => setDrift(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Scale />} Save as live symphony
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Not now
        </Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}

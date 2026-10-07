"use client";

import { Braces, LayoutList } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBacktest } from "@/hooks/use-backtest";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { useResolveTokens } from "@/hooks/use-resolve-tokens";
import type { BacktestConfig } from "@/lib/backtest/types";
import { emptyGroup } from "@/lib/symphony/edit";
import { barsNeeded } from "@/lib/symphony/evaluate";
import { EXAMPLE_SYMPHONIES } from "@/lib/symphony/examples";
import type { MarketData } from "@/lib/symphony/market-data";
import { collectMints } from "@/lib/symphony/mints";
import type { Symphony } from "@/lib/symphony/types";
import { validateSymphony, type ValidationIssue } from "@/lib/symphony/validate";
import { useSymphonyEditor, type SaveStatus } from "@/stores/symphony-editor";

import { AllocationPanel } from "./allocation-panel";
import { BacktestResults } from "./backtest-results";
import { EditorContext, type EditorContextValue } from "./editor-context";
import { JsonEditor } from "./json-editor";
import { NodeCard } from "./node-card";
import { selectClass } from "./indicator-select";

const TEMPLATES: { label: string; symphony: () => Symphony }[] = [
  {
    label: "Blank",
    symphony: () => ({ version: 1, name: "Untitled", root: emptyGroup("Portfolio") }),
  },
  ...EXAMPLE_SYMPHONIES.map((s) => ({ label: s.name, symphony: () => structuredClone(s) })),
];

/** "Saved" only when the latest edit is the one stored; otherwise it's pending. */
function saveText(status: SaveStatus, upToDate: boolean): string {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Couldn't save. Your draft is kept in this browser.";
  return upToDate && status === "saved" ? "Saved" : "Unsaved changes…";
}

/** The /create editor: nested cards, live validation, today's allocation and a backtest. */
export function SymphonyEditor() {
  const { ready, notFound } = useDraftAutosave();
  const symphony = useSymphonyEditor((s) => s.symphony);
  const tokens = useSymphonyEditor((s) => s.tokens);
  const editRoot = useSymphonyEditor((s) => s.editRoot);
  const setName = useSymphonyEditor((s) => s.setName);
  const loadSymphony = useSymphonyEditor((s) => s.loadSymphony);
  const rememberTokens = useSymphonyEditor((s) => s.rememberTokens);
  const saveStatus = useSymphonyEditor((s) => s.saveStatus);
  const upToDate = useSymphonyEditor((s) => s.revision === s.savedRevision);
  const [mode, setMode] = useState<"cards" | "json">("cards");
  const [dragging, setDragging] = useState<string | null>(null);
  const backtest = useBacktest();
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig | null>(null);

  const mints = useMemo(() => [...collectMints(symphony.root)], [symphony.root]);
  useResolveTokens(mints);

  const issues = useMemo<ValidationIssue[]>(() => {
    const found = validateSymphony(symphony, { isKnownMint: (mint) => mint in tokens });
    return symphony.name.trim() ? found : [{ path: "name", message: "Give it a name" }, ...found];
  }, [symphony, tokens]);

  const context = useMemo<EditorContextValue>(
    () => ({
      issues,
      tokenOf: (mint) => tokens[mint],
      rememberToken: (token) => rememberTokens([token]),
      edit: editRoot,
      dragging,
      setDragging,
    }),
    [issues, tokens, rememberTokens, editRoot, dragging],
  );

  if (!ready) return <Skeleton className="h-96 w-full" />;

  const runBacktest = (data: MarketData) => {
    const last = data.dates.length - 1;
    const config: BacktestConfig = {
      startDate: data.dates[Math.min(Math.max(barsNeeded(symphony.root), 1), last)] ?? "",
      endDate: data.dates[last] ?? "",
      rebalance: { kind: "weekly" },
      startingCapitalUsdc: 1000,
      feeBps: 10,
      slippageBps: 20,
    };
    setBacktestConfig(config);
    void backtest.run(symphony, config);
  };

  return (
    <EditorContext.Provider value={context}>
      <div className="space-y-4">
        {notFound && (
          <Alert>
            <AlertDescription>
              That draft link wasn&apos;t found, so your last local draft is open instead.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Symphony name"
            aria-invalid={!symphony.name.trim() || undefined}
            value={symphony.name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 max-w-sm text-base font-medium"
          />
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {saveText(saveStatus, upToDate)}
          </span>
          <span className="flex-1" />
          <select
            aria-label="Start a new draft from"
            className={selectClass}
            value=""
            onChange={(e) => {
              const template = TEMPLATES[Number(e.target.value)];
              if (template) loadSymphony(template.symphony(), crypto.randomUUID());
            }}
          >
            <option value="" disabled>
              New draft from…
            </option>
            {TEMPLATES.map((t, i) => (
              <option key={t.label} value={i}>
                {t.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={mode === "json"}
            onClick={() => setMode(mode === "json" ? "cards" : "json")}
          >
            {mode === "json" ? <LayoutList /> : <Braces />}
            {mode === "json" ? "Edit as cards" : "Edit as JSON"}
          </Button>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {mode === "json" ? (
              <JsonEditor
                symphony={symphony}
                onApply={(next) => {
                  loadSymphony(next);
                  setMode("cards");
                }}
              />
            ) : (
              <NodeCard node={symphony.root} path="root" slot={{ kind: "root" }} />
            )}
            {issues.length > 0 && (
              <p className="mt-2 text-xs text-destructive">
                {issues.length} {issues.length === 1 ? "problem" : "problems"} to fix.
              </p>
            )}
          </div>
          <aside className="lg:sticky lg:top-4">
            <AllocationPanel
              symphony={symphony}
              valid={issues.length === 0}
              backtesting={backtest.state.status === "running"}
              onBacktest={runBacktest}
            />
          </aside>
        </div>

        <BacktestResults state={backtest.state} config={backtestConfig} />
      </div>
    </EditorContext.Provider>
  );
}

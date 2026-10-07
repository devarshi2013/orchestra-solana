"use client";

import { Braces, Check, CircleAlert, CloudOff, LayoutList, Loader2, Rocket } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AskAiPanel } from "@/components/assistant/ask-ai-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useBacktest } from "@/hooks/use-backtest";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { useAssetRegistry } from "@/hooks/use-asset-registry";
import { assetToToken } from "@/lib/assets/token-info";
import type { BacktestConfig } from "@/lib/backtest/types";
import { emptyGroup } from "@/lib/symphony/edit";
import { barsNeeded } from "@/lib/symphony/evaluate";
import { EXAMPLE_SYMPHONIES } from "@/lib/symphony/examples";
import type { MarketData } from "@/lib/symphony/market-data";
import type { Symphony } from "@/lib/symphony/types";
import { validateSymphony, type ValidationIssue } from "@/lib/symphony/validate";
import { cn } from "@/lib/utils";
import { useSymphonyEditor, type SaveStatus } from "@/stores/symphony-editor";

import { AllocationPanel } from "./allocation-panel";
import { BacktestResults } from "./backtest-results";
import { EditorContext, type EditorContextValue } from "./editor-context";
import { JsonEditor } from "./json-editor";
import { NodeCard } from "./node-card";

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

/** The autosave state as a small status pill. */
function SaveStatusPill({ status, upToDate }: { status: SaveStatus; upToDate: boolean }) {
  const saved = upToDate && status === "saved";
  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150",
        status === "error"
          ? "border-destructive/30 bg-destructive/6 text-destructive"
          : saved
            ? "border-success/30 bg-success/8 text-success"
            : "bg-surface-raised text-muted-foreground",
      )}
    >
      {status === "saving" ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : status === "error" ? (
        <CloudOff className="size-3" aria-hidden />
      ) : saved ? (
        <Check className="size-3" aria-hidden />
      ) : (
        <span className="size-1.5 rounded-full bg-warning" aria-hidden />
      )}
      {saveText(status, upToDate)}
    </span>
  );
}

/** The editor's shape while the local draft is restored. */
function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the editor">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-[28rem] w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
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
  const draftId = useSymphonyEditor((s) => s.draftId);
  const upToDate = useSymphonyEditor((s) => s.revision === s.savedRevision);
  const [mode, setMode] = useState<"cards" | "json">("cards");
  const [dragging, setDragging] = useState<string | null>(null);
  const backtest = useBacktest();
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig | null>(null);

  // The registry is the only source of mints: show its names, and flag anything else.
  const { registry, isListed } = useAssetRegistry();
  useEffect(() => {
    if (registry) rememberTokens([...registry.stocks, ...registry.crypto].map(assetToToken));
  }, [registry, rememberTokens]);

  const issues = useMemo<ValidationIssue[]>(() => {
    // Until the registry loads, don't flag every mint as unknown.
    const found = validateSymphony(symphony, { isKnownMint: isListed ?? (() => true) });
    return symphony.name.trim() ? found : [{ path: "name", message: "Give it a name" }, ...found];
  }, [symphony, isListed]);

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

  // Toasts for things that happen out of view: a failed autosave, a finished backtest.
  const lastSave = useRef(saveStatus);
  useEffect(() => {
    if (saveStatus === "error" && lastSave.current !== "error") {
      toast.error("Couldn't save the draft", "It's kept in this browser; your next edit retries.");
    }
    lastSave.current = saveStatus;
  }, [saveStatus]);
  const lastBacktest = useRef(backtest.state.status);
  const backtestState = backtest.state;
  useEffect(() => {
    const state = backtestState;
    if (lastBacktest.current === "running") {
      if (state.status === "done") {
        toast.success(
          "Backtest complete",
          `${state.result.equity.length - 1} days simulated. Results are below.`,
        );
      } else if (state.status === "error") {
        toast.error("Backtest failed", state.message);
      }
    }
    lastBacktest.current = state.status;
  }, [backtestState]);

  if (!ready) return <EditorSkeleton />;

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

  const nameMissing = !symphony.name.trim();
  const treeIssues = issues.filter((i) => i.path !== "name");

  return (
    <EditorContext.Provider value={context}>
      <div className="space-y-6">
        {notFound && (
          <Alert variant="warning">
            <CircleAlert />
            <AlertDescription>
              That draft link wasn&apos;t found, so your last local draft is open instead.
            </AlertDescription>
          </Alert>
        )}

        <Section
          title="Details"
          description="Name your symphony or start over from a template. Drafts save automatically, in this browser and to the server."
          actions={<SaveStatusPill status={saveStatus} upToDate={upToDate} />}
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-start">
            <Field
              id="symphony-name"
              label="Name"
              error={nameMissing ? "Give it a name" : undefined}
            >
              <Input
                id="symphony-name"
                aria-label="Symphony name"
                aria-invalid={nameMissing || undefined}
                aria-describedby={nameMissing ? "symphony-name-message" : undefined}
                value={symphony.name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SOL trend follower"
                className="text-[0.9375rem] font-medium"
              />
            </Field>
            <Field
              id="symphony-template"
              label="Start a new draft from"
              hint="Replaces the current draft."
            >
              <NativeSelect
                id="symphony-template"
                aria-label="Start a new draft from"
                className="w-full"
                value=""
                onChange={(e) => {
                  const template = TEMPLATES[Number(e.target.value)];
                  if (!template) return;
                  loadSymphony(template.symphony(), crypto.randomUUID());
                  toast.info(`New draft from “${template.label}”`);
                }}
              >
                <option value="" disabled>
                  Choose a template…
                </option>
                {TEMPLATES.map((t, i) => (
                  <option key={t.label} value={i}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex flex-col gap-2">
              <span
                className="hidden text-[0.8125rem] leading-none font-medium sm:block"
                aria-hidden
              >
                &nbsp;
              </span>
              <Button asChild variant="outline" aria-disabled={issues.length > 0 || undefined}>
                <Link href={`/invest/new?draft=${draftId ?? ""}`}>
                  <Rocket /> Invest
                </Link>
              </Button>
            </div>
          </div>
        </Section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Tabs value={mode} onValueChange={(value) => setMode(value as "cards" | "json")}>
            <Section
              title="Strategy"
              description="Nest assets, groups, conditions and filters. Drag a block by its handle to move it."
              actions={
                <TabsList aria-label="Editor view">
                  <TabsTrigger value="cards">
                    <LayoutList /> Blocks
                  </TabsTrigger>
                  <TabsTrigger value="json">
                    <Braces /> JSON
                  </TabsTrigger>
                </TabsList>
              }
              className="min-w-0"
            >
              <TabsContent value="cards" className="space-y-4">
                <NodeCard node={symphony.root} path="root" slot={{ kind: "root" }} />
              </TabsContent>
              <TabsContent value="json">
                <JsonEditor
                  symphony={symphony}
                  onApply={(next) => {
                    loadSymphony(next);
                    setMode("cards");
                    toast.success("JSON applied");
                  }}
                />
              </TabsContent>
              {treeIssues.length > 0 && (
                <p
                  className="mt-4 flex items-center gap-1.5 text-sm text-destructive"
                  aria-live="polite"
                >
                  <CircleAlert className="size-4 shrink-0" aria-hidden />
                  {treeIssues.length} {treeIssues.length === 1 ? "problem" : "problems"} to fix,
                  marked in red above.
                </p>
              )}
            </Section>
          </Tabs>
          <aside className="lg:sticky lg:top-24">
            <AllocationPanel
              symphony={symphony}
              valid={issues.length === 0}
              backtesting={backtest.state.status === "running"}
              onBacktest={runBacktest}
            />
          </aside>
        </div>

        <AskAiPanel
          current={symphony}
          context={() => ({ kind: "editor", symphony: useSymphonyEditor.getState().symphony })}
          onAccept={async (next) => loadSymphony(next)}
          acceptLabel="Apply to draft"
          acceptNote="Replaces the draft in the editor; you can still edit or undo it by hand."
          description="Explain this symphony, suggest changes (shown as a diff you accept or reject) or compare backtests."
        />

        <BacktestResults state={backtest.state} config={backtestConfig} />
      </div>
    </EditorContext.Provider>
  );
}

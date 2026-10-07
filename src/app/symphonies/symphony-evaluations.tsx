import { AllocationList } from "@/components/symphony/allocation-list";
import { EvaluationWarnings } from "@/components/symphony/evaluation-warnings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDailyMarketData } from "@/lib/market/store";
import { evaluateWithWarnings } from "@/lib/symphony/evaluate";
import { EXAMPLE_SYMPHONIES, EXAMPLE_TOKEN_SYMBOLS } from "@/lib/symphony/examples";
import type { MarketData } from "@/lib/symphony/market-data";
import { collectMints } from "@/lib/symphony/mints";
import { describeWarning } from "@/lib/symphony/warnings";

const symbolOf = (mint: string) => EXAMPLE_TOKEN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}…`;

/** Evaluates each example symphony on the latest stored daily close. */
export async function SymphonyEvaluations() {
  const mints = [...new Set(EXAMPLE_SYMPHONIES.flatMap((s) => [...collectMints(s.root)]))];
  let data: MarketData;
  try {
    data = await loadDailyMarketData(mints);
  } catch (error) {
    console.error("[symphonies] loading price history failed", error);
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load price history</AlertTitle>
        <AlertDescription>
          Check that Postgres is running and migrated (`pnpm db:up && pnpm db:migrate`).
        </AlertDescription>
      </Alert>
    );
  }

  const asOf = data.dates[data.dates.length - 1];
  return (
    <div className="space-y-4">
      {asOf ? (
        <p className="text-sm text-muted-foreground">As of the {asOf} daily close (UTC).</p>
      ) : (
        <Alert>
          <AlertTitle>No price history stored yet</AlertTitle>
          <AlertDescription>
            Run the sync job (GET /api/cron/prices) to backfill candles from Birdeye.
          </AlertDescription>
        </Alert>
      )}
      {EXAMPLE_SYMPHONIES.map((symphony) => {
        const { allocation, warnings } = evaluateWithWarnings(symphony.root, data, asOf ?? "");
        const rows = Object.entries(allocation)
          .map(([mint, weight]) => ({ mint, symbol: symbolOf(mint), weight }))
          .sort((a, b) => b.weight - a.weight);
        return (
          <Card key={symphony.name}>
            <CardHeader>
              <CardTitle>{symphony.name}</CardTitle>
              {symphony.description && <CardDescription>{symphony.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              <EvaluationWarnings messages={warnings.map((w) => describeWarning(w, symbolOf))} />
              <AllocationList rows={rows} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

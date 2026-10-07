"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantApi } from "@/lib/api-client";
import type { ConversationSummary, ExecutionView } from "@/lib/assistant/views";
import { formatUsd } from "@/lib/backtest/format";

import { ExecutionWithRetry } from "./execution-items";

const STATUS: Record<
  ExecutionView["status"],
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  planned: { label: "Not started", variant: "outline" },
  executing: { label: "In progress", variant: "secondary" },
  completed: { label: "Bought", variant: "secondary" },
  partial: { label: "Partly bought", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** The wallet's bought assistant plans (with retry for items not bought) and saved chats. */
export function HistoryView() {
  const [data, setData] = useState<{
    executions: ExecutionView[];
    conversations: ConversationSummary[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([assistantApi.executions(), assistantApi.conversations()])
      .then(([executions, conversations]) => !cancelled && setData({ executions, conversations }))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Bought plans</h2>
        {data.executions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No plans bought yet. Ask the{" "}
            <Link href="/assistant" className="text-primary hover:underline">
              assistant
            </Link>{" "}
            for one.
          </p>
        ) : (
          data.executions.map((execution) => {
            const status =
              execution.status === "partial" &&
              execution.items.every((i) => i.status !== "succeeded")
                ? { label: "Not bought", variant: "destructive" as const }
                : STATUS[execution.status];
            return (
              <Card key={execution.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {formatUsd(execution.totalUsdc)} plan
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {when(execution.createdAt)} · Ranking: {execution.rankingMethod}
                    {execution.conversationId && (
                      <>
                        {" · "}
                        <Link
                          href={`/assistant?c=${execution.conversationId}`}
                          className="text-primary hover:underline"
                        >
                          Open chat
                        </Link>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExecutionWithRetry initial={execution} />
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Chats</h2>
        {data.conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chats yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {data.conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/assistant?c=${c.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  {c.executions > 0 && (
                    <Badge variant="secondary">
                      {c.executions} {c.executions === 1 ? "plan" : "plans"} bought
                    </Badge>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {when(c.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

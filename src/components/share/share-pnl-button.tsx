"use client";

import { Check, Copy, Download, Link2, Share } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";

import { SoftButton } from "@/components/assistant/controls";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

import type { PnlCardPeriod } from "./pnl-card";

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "30d", label: "30 days" },
] as const;

type Action = "image" | "link";

/** The card image's absolute URL (shareable as a link and as an X post). */
const cardUrl = (wallet: string, period: PnlCardPeriod) =>
  `${window.location.origin}/api/pnl-card?${new URLSearchParams({ wallet, period })}`;

async function cardBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`P&L card ${response.status}`);
  return response.blob();
}

/** "Share": a popover with the wallet's P&L card and ways to share it. */
export function SharePnlButton({ wallet, className }: { wallet: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PnlCardPeriod>("all");
  const [done, setDone] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The image's load state, for the URL it was reported for (a new period starts loading).
  const [loaded, setLoaded] = useState<{ url: string; ok: boolean } | null>(null);
  const url = open ? cardUrl(wallet, period) : null;
  const state = !url || loaded?.url !== url ? "loading" : loaded.ok ? "ready" : "error";

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 1400);
    return () => window.clearTimeout(timer);
  }, [done]);

  const run = (action: Action, task: () => Promise<void>) =>
    task().then(
      () => setDone(action),
      (reason: unknown) => {
        console.error("[share] failed", reason);
        setError(action === "image" ? "Couldn't copy the image" : "Couldn't copy the link");
      },
    );

  const copyImage = () =>
    run("image", async () => {
      const blob = await cardBlob(url!);
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    });
  const copyLink = () => run("link", () => navigator.clipboard.writeText(url!));
  const download = async () => {
    try {
      const href = URL.createObjectURL(await cardBlob(url!));
      const link = Object.assign(document.createElement("a"), {
        href,
        download: `tickertape-pnl-${period}.png`,
      });
      link.click();
      URL.revokeObjectURL(href);
    } catch (reason) {
      console.error("[share] download failed", reason);
      setError("Couldn't download the image");
    }
  };
  const postUrl = url
    ? `https://x.com/intent/post?${new URLSearchParams({ text: "My Tickertape P&L", url })}`
    : undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <SoftButton className={className}>
          <Share className="size-4" aria-hidden />
          Share
        </SoftButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(440px,calc(100vw-24px))] origin-(--radix-popover-content-transform-origin) rounded-[20px] bg-white p-3 shadow-float outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-text-extra-high">
              P&amp;L card
            </span>
            <SegmentedControl
              aria-label="Period"
              items={PERIODS}
              value={period}
              onValueChange={(next) => {
                setPeriod(next);
                setError(null);
              }}
            />
          </div>
          <div className="relative aspect-[1200/630] overflow-hidden rounded-[14px] bg-soft">
            {state === "loading" && <div className="absolute inset-0 animate-pulse bg-soft" />}
            {state === "error" ? (
              <p className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-muted">
                Couldn&apos;t load the card
              </p>
            ) : (
              url && (
                // eslint-disable-next-line @next/next/no-img-element -- a generated PNG, not a static asset.
                <img
                  key={url}
                  src={url}
                  alt="P&L card"
                  className={cn(
                    "size-full object-cover transition-opacity duration-200",
                    state === "ready" ? "opacity-100" : "opacity-0",
                  )}
                  onLoad={() => setLoaded({ url, ok: true })}
                  onError={() => setLoaded({ url, ok: false })}
                />
              )
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SoftButton onClick={copyImage} disabled={state !== "ready"} className="px-3">
              {done === "image" ? <Check className="size-4" /> : <Copy className="size-4" />}
              {done === "image" ? "Copied" : "Copy"}
            </SoftButton>
            <SoftButton onClick={download} disabled={state !== "ready"} className="px-3">
              <Download className="size-4" />
              Save
            </SoftButton>
            <SoftButton onClick={copyLink} disabled={!url} className="px-3">
              {done === "link" ? <Check className="size-4" /> : <Link2 className="size-4" />}
              {done === "link" ? "Copied" : "Link"}
            </SoftButton>
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!postUrl}
              className="inline-flex h-9 items-center justify-center rounded-full bg-gray-1400 px-3 text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap text-white transition-colors duration-150 hover:bg-gray-1300 focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:outline-none aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              Post on X
            </a>
          </div>
          {error && (
            <p role="alert" className="mt-2 px-1 text-[12.5px] text-status-error-text">
              {error}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

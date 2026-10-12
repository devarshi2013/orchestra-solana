"use client";

import { useEffect, useSyncExternalStore } from "react";

import { pricesApi } from "@/lib/api-client";
import type { PricesResponse } from "@/lib/strategies/types";

/**
 * Live prices shared by every component on the page: all subscribed mints are
 * read in one request every 10 s while the tab is visible, so a chat with many
 * strategy cards makes one call, not one per card. A failed refresh keeps the
 * last prices but marks them stale.
 */

type Snapshot = { prices: PricesResponse["prices"]; asOf: string | null; stale: boolean };

const INTERVAL_MS = 10_000;
const subscribers = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot: Snapshot = { prices: {}, asOf: null, stale: false };
let timer: number | undefined;
let inFlight = false;

const emit = () => listeners.forEach((l) => l());

async function refresh() {
  const mints = [...subscribers.keys()];
  if (mints.length === 0 || inFlight || document.visibilityState !== "visible") return;
  inFlight = true;
  try {
    const { prices, asOf } = await pricesApi.get(mints);
    snapshot = { prices: { ...snapshot.prices, ...prices }, asOf, stale: false };
  } catch (e) {
    console.error("[prices] refresh failed", e);
    snapshot = { ...snapshot, stale: true };
  } finally {
    inFlight = false;
    emit();
  }
}

function retain(mint: string) {
  const fresh = !subscribers.has(mint);
  subscribers.set(mint, (subscribers.get(mint) ?? 0) + 1);
  if (timer === undefined) {
    timer = window.setInterval(() => void refresh(), INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  // A mint we have no price for yet is read right away (batched with any others mounting now).
  if (fresh && !(mint in snapshot.prices)) queueMicrotask(() => void refresh());
}

function release(mint: string) {
  const count = (subscribers.get(mint) ?? 1) - 1;
  if (count > 0) subscribers.set(mint, count);
  else subscribers.delete(mint);
  if (subscribers.size === 0 && timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
    document.removeEventListener("visibilitychange", onVisible);
  }
}

function onVisible() {
  if (document.visibilityState === "visible") void refresh();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const SERVER: Snapshot = { prices: {}, asOf: null, stale: false };

/** The live price and 24h change of one token (null until read, or when Jupiter has none). */
export function useTokenPrice(mint: string) {
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER,
  );
  useEffect(() => {
    retain(mint);
    return () => release(mint);
  }, [mint]);
  return { quote: current.prices[mint] ?? null, asOf: current.asOf, stale: current.stale };
}

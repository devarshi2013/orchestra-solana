"use client";

import { useCallback, useEffect, useState } from "react";

import { usePageVisible } from "@/hooks/use-page-visible";
import { useSession } from "@/hooks/use-session";
import { portfolioApi, profileApi } from "@/lib/api-client";
import { friendlyError } from "@/lib/friendly-error";
import type { HistoryPeriod, PortfolioPoint, ProfileResponse } from "@/lib/strategies/types";

export type ProfileState = {
  data: ProfileResponse | null;
  /** The latest read's error (data, if any, is from an earlier read). */
  error: string | null;
  loading: boolean;
  /** Read again now (after creating, cancelling or buying). */
  reload: () => void;
};

/**
 * The signed-in wallet's profile (GET /api/profile), read every `ms` while the
 * tab is visible. Nothing is read while signed out.
 */
export function useProfile(ms = 30_000): ProfileState {
  const { wallet, status } = useSession();
  const visible = usePageVisible();
  const [state, setState] = useState<{
    wallet: string | null;
    data: ProfileResponse | null;
    error: string | null;
  }>({ wallet: null, data: null, error: null });
  const [reads, setReads] = useState(0);
  const reload = useCallback(() => setReads((n) => n + 1), []);
  // Another wallet's profile is never shown.
  const current = state.wallet === wallet ? state : { wallet, data: null, error: null };

  useEffect(() => {
    if (status !== "signed-in" || !wallet || !visible) return;
    let live = true;
    const load = () =>
      profileApi
        .get()
        .then((data) => live && setState({ wallet, data, error: null }))
        .catch((e: unknown) => {
          if (!live) return;
          console.error("[profile] read failed", e);
          setState((s) =>
            s.wallet === wallet
              ? { ...s, error: friendlyError(e) }
              : { wallet, data: null, error: friendlyError(e) },
          );
        });
    void load();
    const timer = window.setInterval(load, ms);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [status, wallet, visible, ms, reads]);

  return {
    data: current.data,
    error: current.error,
    loading: status === "signed-in" && !current.data && !current.error,
    reload,
  };
}

export type HistoryState = { points: PortfolioPoint[] | null; error: string | null };

/** The signed-in wallet's daily portfolio history for `period`, read again every 5 minutes. */
export function usePortfolioHistory(period: HistoryPeriod): HistoryState {
  const { wallet, status } = useSession();
  const visible = usePageVisible();
  const key = `${wallet}:${period}`;
  const [state, setState] = useState<{ key: string } & HistoryState>({
    key: "",
    points: null,
    error: null,
  });

  useEffect(() => {
    if (status !== "signed-in" || !wallet || !visible) return;
    let live = true;
    const load = () =>
      portfolioApi
        .history(period)
        .then(({ points }) => live && setState({ key, points, error: null }))
        .catch((e: unknown) => {
          if (!live) return;
          console.error("[profile] history failed", e);
          setState((s) => ({ ...s, key, error: friendlyError(e) }));
        });
    void load();
    const timer = window.setInterval(load, 5 * 60_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [status, wallet, visible, period, key]);

  return state.key === key ? state : { points: null, error: null };
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { assetsApi, type RegistryView } from "@/lib/api-client";
import { indexAssets } from "@/lib/assets/registry";

let pending: Promise<RegistryView> | null = null;

/** The verified asset registry, fetched once per page load and shared. */
export function useAssetRegistry() {
  const [registry, setRegistry] = useState<RegistryView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (pending ??= assetsApi.registry())
      .then((r) => live && setRegistry(r))
      .catch((e: Error) => {
        pending = null;
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);

  const index = useMemo(
    () => (registry ? indexAssets([...registry.stocks, ...registry.crypto]) : null),
    [registry],
  );
  return { registry, error, ...index };
}

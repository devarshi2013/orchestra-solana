"use client";

import { Bell } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { clientEnv } from "@/env/client";
import { investApi } from "@/lib/api-client";

const VAPID_KEY = clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const noopSubscribe = () => () => {};

/** Optional browser push for "rebalance due". Hidden unless VAPID keys are configured. */
export function PushToggle() {
  // Browser capabilities: read on the client, false while server-rendering.
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(VAPID_KEY) && "serviceWorker" in navigator && "PushManager" in window,
    () => false,
  );
  const [status, setStatus] = useState<"off" | "on" | "busy" | "denied">("off");

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => sub && setStatus("on"))
      .catch(() => {});
  }, [supported]);

  if (!supported) return null;

  const enable = async () => {
    setStatus("busy");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setStatus("denied");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(VAPID_KEY!),
      });
      await investApi.subscribePush(subscription.toJSON());
      setStatus("on");
    } catch {
      setStatus("off");
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <Bell className="size-4 text-muted-foreground" />
      {status === "on" ? (
        <span>Browser notifications are on for this device.</span>
      ) : status === "denied" ? (
        <span className="text-muted-foreground">
          Notifications are blocked in this browser&apos;s settings.
        </span>
      ) : (
        <Button variant="outline" size="sm" onClick={enable} disabled={status === "busy"}>
          Notify me in this browser too
        </Button>
      )}
    </div>
  );
}

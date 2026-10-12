"use client";

import { TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { SoftButton } from "@/components/assistant/controls";
import { SharePnlButton } from "@/components/share/share-pnl-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLivePrices } from "@/hooks/use-live-prices";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { profileApi, strategiesApi } from "@/lib/api-client";
import { friendlyError } from "@/lib/friendly-error";

import { ProfileView, type ProfileActions } from "./profile-view";

/** /profile: sign in with the wallet, then the live portfolio, strategies and trades. */
export function ProfilePage() {
  const session = useSession();
  const profile = useProfile(30_000);
  const data = profile.data;
  const mints = useMemo(
    () => [...(data?.positions ?? []), ...(data?.strategies ?? [])].map((x) => x.mint),
    [data],
  );
  const prices = useLivePrices(mints, 5_000);
  const { reload } = profile;
  const actions = useMemo<ProfileActions>(
    () => ({
      reload,
      setStatus: async (id, status) => void (await strategiesApi.update(id, { status })),
      remove: async (id) => void (await strategiesApi.remove(id)),
      setWebhook: async (url) => {
        await profileApi.setWebhook(url);
        reload();
      },
      markRead: async () => {
        await profileApi.markRead();
        reload();
      },
    }),
    [reload],
  );

  if (session.status === "loading") return <ProfileSkeleton />;
  if (session.status === "signed-out") return <SignIn signIn={session.signIn} />;
  if (!data) {
    return profile.error ? (
      <p className="flex items-center gap-1.5 text-[13.5px] text-status-error-text">
        <TriangleAlert className="size-4" aria-hidden /> {profile.error}
      </p>
    ) : (
      <ProfileSkeleton />
    );
  }
  return (
    <ProfileView
      profile={data}
      prices={prices}
      error={profile.error}
      actions={actions}
      share={<SharePnlButton wallet={data.wallet} />}
    />
  );
}

function SignIn({ signIn }: { signIn: () => Promise<void> }) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });
  const run = () => {
    setState({ busy: true, error: null });
    signIn()
      .then(() => setState({ busy: false, error: null }))
      .catch((e: unknown) => setState({ busy: false, error: friendlyError(e) }));
  };
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3">
      <SoftButton dark className="h-11 px-5" disabled={state.busy} onClick={run}>
        {state.busy ? "Check your wallet…" : "Sign in with your wallet"}
      </SoftButton>
      {state.error && <p className="text-[12.5px] text-status-error-text">{state.error}</p>}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-12" aria-busy>
      <div className="space-y-3">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-10 w-56" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-36 w-full rounded-[16px]" />
        </div>
      ))}
    </div>
  );
}

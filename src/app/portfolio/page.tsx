import type { Metadata } from "next";

import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Portfolio" };

export default function Profile() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-6 pt-28 pb-24">
      <ProfilePage />
    </main>
  );
}

import { notFound } from "next/navigation";

import { ProfilePreview } from "./profile-preview";

/** Dev-only: the signed-in profile with sample data, for checking its layout. */
export default function ProfilePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ProfilePreview />;
}

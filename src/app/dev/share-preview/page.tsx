import { notFound } from "next/navigation";

import { SharePreview } from "./share-preview";

/** Dev-only: the share popover, a sample P&L card and fill toasts, for checking their look. */
export default function SharePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SharePreview />;
}

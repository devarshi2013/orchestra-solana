import { notFound } from "next/navigation";

import { ChatPreview } from "./chat-preview";

/** Dev-only: sample assistant replies, for checking how chat formatting renders. */
export default function ChatPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ChatPreview />;
}

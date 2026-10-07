import type { Metadata } from "next";

import { SymphonyEditor } from "@/components/editor/symphony-editor";

export const metadata: Metadata = { title: "Create · Orchestra" };

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create a symphony</h1>
        <p className="text-sm text-muted-foreground">
          Build the strategy as nested blocks. Drafts save automatically, in this browser and to the
          server.
        </p>
      </div>
      <SymphonyEditor />
    </main>
  );
}

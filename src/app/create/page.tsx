import type { Metadata } from "next";

import { SymphonyEditor } from "@/components/editor/symphony-editor";
import { PageHeader } from "@/components/ui/section";

export const metadata: Metadata = { title: "Create · Orchestra" };

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Symphony editor"
        title="Create a symphony"
        description="Build a rule-based portfolio from nested blocks, see what it holds today, and backtest it on stored prices before you invest."
      />
      <SymphonyEditor />
    </main>
  );
}

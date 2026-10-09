import { ArrowLeft, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <LogoMark className="size-12" />
      <p className="mt-6 font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-3 text-muted-foreground">
        The link may be old or mistyped. Ask the assistant, or head back home.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/chat">
            <Sparkles /> Ask the assistant
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft /> Home
          </Link>
        </Button>
      </div>
    </main>
  );
}

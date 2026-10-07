import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Orchestra</h1>
      <p className="text-muted-foreground">
        Rule-based Solana token portfolios. Strategies are coming next; for now you can test the
        swap execution path.
      </p>
      <Button asChild className="self-start">
        <Link href="/swap">Open swap</Link>
      </Button>
    </main>
  );
}

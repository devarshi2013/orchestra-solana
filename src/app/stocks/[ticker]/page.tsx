import type { Metadata } from "next";
import { Suspense } from "react";

import { StockPage, StockSkeleton } from "@/components/markets/stock-page";

export async function generateMetadata({
  params,
}: PageProps<"/stocks/[ticker]">): Promise<Metadata> {
  const { ticker } = await params;
  return { title: decodeURIComponent(ticker).toUpperCase() };
}

async function Stock({ params }: Pick<PageProps<"/stocks/[ticker]">, "params">) {
  const { ticker } = await params;
  return <StockPage ticker={decodeURIComponent(ticker)} />;
}

/** One company: chart, figures and every issuer's token, with a wallet-signed trade panel. */
export default function StockRoute({ params }: PageProps<"/stocks/[ticker]">) {
  return (
    // The ticker is only known at request time; the skeleton is prerendered.
    <Suspense
      fallback={
        <main className="min-h-dvh bg-white pb-24">
          <StockSkeleton />
        </main>
      }
    >
      <Stock params={params} />
    </Suspense>
  );
}

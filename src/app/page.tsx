import { HowItWorks } from "@/components/how-it-works";
import { MarketDashboard } from "@/components/market/market-dashboard";
import { Reveal } from "@/components/motion";
import { SubscribeBox } from "@/components/subscribe-box";
import { TAGLINE } from "@/lib/brand";

/**
 * The home page: a live market dashboard (prices from Jupiter, history from
 * GeckoTerminal) with one button into the chat, in the hero.
 */
export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold sm:text-4xl">{TAGLINE}</h1>
          <p className="text-sm text-muted-foreground">
            Live markets: tokenized US stocks and Solana tokens, priced by Jupiter.
          </p>
        </div>
        <Reveal>
          <MarketDashboard />
        </Reveal>
      </section>

      <HowItWorks />
      <SubscribeBox />
    </main>
  );
}

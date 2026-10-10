import { AnnouncementBar } from "@/components/home/announcement-bar";
import { Faq } from "@/components/home/faq";
import { FeatureGrid } from "@/components/home/feature-grid";
import { FeatureRows } from "@/components/home/feature-rows";
import { Hero } from "@/components/home/hero";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Statement } from "@/components/home/statement";
import { SubscribeBox } from "@/components/subscribe-box";

/**
 * The home page: announcement bar, navbar, hero, statement, the three product
 * rows, the feature grid, FAQ and the email signup. No market data: nothing
 * here calls a price or quote API. It has its own navbar, so the site header
 * is hidden here (data-home-page, see globals.css).
 */
export default function Home() {
  return (
    <div data-home-page className="flex flex-1 flex-col">
      <AnnouncementBar />
      <HomeNavbar />
      <main className="flex-1">
        <Hero />
        <Statement />
        <FeatureRows />
        <FeatureGrid />
        <Faq />
        <SubscribeBox />
        <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-center text-xs text-muted-foreground sm:px-6">
          Research only. Not financial advice.
        </p>
      </main>
    </div>
  );
}

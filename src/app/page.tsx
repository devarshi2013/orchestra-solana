import { AnnouncementBar } from "@/components/home/announcement-bar";
import { BentoGrid } from "@/components/home/bento-grid";
import { Grain } from "@/components/home/effects";
import { Faq } from "@/components/home/faq";
import { FeatureRows } from "@/components/home/feature-rows";
import { FinalCta } from "@/components/home/final-cta";
import { Hero } from "@/components/home/hero";
import { HowQuillWorks } from "@/components/home/how-quill-works";
import { Statement } from "@/components/home/statement";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { SubscribeBox } from "@/components/subscribe-box";

/**
 * The home page: announcement bar, the site navbar (rendered here so it sits
 * under the bar; the layout's copy is hidden: data-home-page, globals.css), hero, statement,
 * how Quill works (four steps), the three product rows, the bento grid, FAQ, email signup and a closing
 * call to action. No market data: nothing here calls a price or quote API.
 */
export default function Home() {
  return (
    // Sideways overflow is clipped here (not per section), so glows can cross section edges.
    <div data-home-page className="relative flex flex-1 flex-col overflow-x-clip">
      <Grain />
      <AnnouncementBar />
      {/* The site navbar, here under the announcement bar (the layout's copy is hidden on this page). */}
      <div className="sticky top-0 z-40">
        <SiteNavbar />
      </div>
      <main id="home-main" className="relative flex-1">
        <Hero />
        <Statement />
        <HowQuillWorks />
        <FeatureRows />
        <BentoGrid />
        <Faq />
        <SubscribeBox />
        <FinalCta />
        <p className="mx-auto w-full max-w-6xl px-4 pb-10 text-center text-xs text-muted-foreground sm:px-6">
          Research only. Not financial advice.
        </p>
      </main>
    </div>
  );
}

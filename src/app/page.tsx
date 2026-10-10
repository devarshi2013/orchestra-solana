import { AnnouncementBar } from "@/components/home/announcement-bar";
import { BentoGrid } from "@/components/home/bento-grid";
import { Grain } from "@/components/home/effects";
import { Faq } from "@/components/home/faq";
import { FeatureRows } from "@/components/home/feature-rows";
import { FinalCta } from "@/components/home/final-cta";
import { Hero } from "@/components/home/hero";
import { HowQuillWorks } from "@/components/home/how-quill-works";
import { HomeNavbar } from "@/components/home/home-navbar";
import { SmoothScroll } from "@/components/home/smooth-scroll";
import { Statement } from "@/components/home/statement";
import { homeFontVariables } from "@/components/home/fonts";
import { SubscribeBox } from "@/components/subscribe-box";

/**
 * The home page, dark only (`.home-dark` re-points the theme tokens; the
 * footer follows on this page). Announcement bar, its own navbar (the site
 * header is hidden here: data-home-page, see globals.css), hero, statement,
 * how Quill works (four steps), the three product rows, the bento grid, FAQ, email signup and a closing
 * call to action. No market data: nothing here calls a price or quote API.
 */
export default function Home() {
  return (
    // Sideways overflow is clipped here (not per section), so glows can cross section edges.
    <div
      data-home-page
      className={`${homeFontVariables} home-dark relative flex flex-1 flex-col overflow-x-clip`}
    >
      <SmoothScroll />
      <Grain />
      <AnnouncementBar />
      <HomeNavbar />
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

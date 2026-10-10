import { Geist_Mono, Instrument_Serif, Manrope, Sora } from "next/font/google";

/**
 * The site's fonts: Sora for headings, Manrope for text, buttons, nav and
 * cards, Instrument Serif Italic for accent words in headings, and Geist Mono
 * for prices, numbers and small labels (tabular figures).
 */
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700"] });
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** The CSS variables for every font, set on <body>. */
export const fontVariables = [sora, manrope, instrumentSerif, geistMono]
  .map((f) => f.variable)
  .join(" ");

import { Instrument_Serif, Manrope, Sora } from "next/font/google";

/**
 * The home page's font pairing, loaded only by the home page (the app pages
 * keep Geist): Sora for headings, Instrument Serif Italic for the accent
 * words, Manrope for body text, buttons, nav and cards. Small labels and
 * numbers use Geist Mono, which the root layout already loads.
 */
export const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700"] });
export const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});
export const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const homeFontVariables = `${sora.variable} ${instrumentSerif.variable} ${manrope.variable}`;

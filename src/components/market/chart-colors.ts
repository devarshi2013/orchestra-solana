/**
 * Liveline draws on a canvas, which can't read CSS variables, so the chart
 * colours are repeated here as hex (keep in sync with src/app/globals.css).
 * The site is monochrome: a rising line is navy (white in dark mode) and a
 * falling one gray, both 4.8:1 or more against the page. The ▲/▼ and +/− on
 * every change say which way it went, so colour is never the only cue.
 */
export const CHART_COLORS = {
  up: { dark: "#f9fafb", light: "#0f1b2d" },
  down: { dark: "#9ca3af", light: "#6b7280" },
  neutral: { dark: "#6b7280", light: "#9ca3af" },
} as const;

export const changeColor = (change: number | null, theme: "dark" | "light") =>
  change === null || change === 0
    ? CHART_COLORS.neutral[theme]
    : change < 0
      ? CHART_COLORS.down[theme]
      : CHART_COLORS.up[theme];

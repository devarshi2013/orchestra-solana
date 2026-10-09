/**
 * Liveline draws on a canvas, which can't read CSS variables, so the data
 * colours are repeated here as hex (keep in sync with src/app/globals.css).
 * Charts use data colours only, never the burgundy brand, so a line is never
 * mistaken for "price down". Lines need 3:1, so these are the brighter chart
 * shades; price *text* uses the darker --success / --destructive tokens.
 */
export const CHART_COLORS = {
  up: { dark: "#4ade80", light: "#15803d" },
  down: { dark: "#f87171", light: "#dc2626" },
  neutral: { dark: "#b8a894", light: "#7a6a55" },
} as const;

export const changeColor = (change: number | null, theme: "dark" | "light") =>
  change === null || change === 0
    ? CHART_COLORS.neutral[theme]
    : change < 0
      ? CHART_COLORS.down[theme]
      : CHART_COLORS.up[theme];

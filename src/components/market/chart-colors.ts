/**
 * Liveline draws on a canvas, which can't read CSS variables, so the brand
 * tokens are repeated here as hex (keep in sync with src/app/globals.css).
 */
export const CHART_COLORS = {
  brand: "#ff5a1f",
  up: { dark: "#16a34a", light: "#15803d" },
  down: { dark: "#f87171", light: "#c81e1e" },
} as const;

export const changeColor = (change: number | null, theme: "dark" | "light") =>
  change !== null && change < 0 ? CHART_COLORS.down[theme] : CHART_COLORS.up[theme];

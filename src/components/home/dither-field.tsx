import type { CSSProperties } from "react";

import { DITHER, GRID } from "@/components/ui/dither-mask";
import { cn } from "@/lib/utils";

// The same stochastic dither as the footer (dense at the bottom, sparse at the
// top), as a mask over the accent colour, drifting slowly sideways.
const STYLES = `
.dfx { position: absolute; inset: 0; overflow: hidden; }
.dfx-dots {
  position: absolute; top: 0; bottom: 0; left: 0;
  width: calc(100% + 360px);
  background: var(--dfx-color);
  -webkit-mask-image: ${GRID}, ${DITHER};
  mask-image: ${GRID}, ${DITHER};
  -webkit-mask-size: 4px 4px, 360px 240px;
  mask-size: 4px 4px, 360px 240px;
  -webkit-mask-repeat: repeat, repeat-x;
  mask-repeat: repeat, repeat-x;
  -webkit-mask-position: 0 0, left bottom;
  mask-position: 0 0, left bottom;
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}
@media (prefers-reduced-motion: no-preference) {
  .dfx-dots { animation: dfx-drift var(--dfx-speed, 60s) linear infinite; }
}
@keyframes dfx-drift { to { translate: -360px 0; } }
`;

/**
 * A field of dithered navy dots that drifts slowly (still under reduced
 * motion). Purely decorative; fills its positioned parent.
 */
export function DitherField({
  className,
  color = "var(--footer-dots)",
  speed = "60s",
  flip = false,
}: {
  className?: string;
  color?: string;
  speed?: string;
  /** Dense at the top instead of the bottom. */
  flip?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn("dfx", flip && "-scale-y-100", className)}
      style={{ "--dfx-color": color, "--dfx-speed": speed } as CSSProperties}
    >
      <style>{STYLES}</style>
      <div className="dfx-dots" />
    </div>
  );
}

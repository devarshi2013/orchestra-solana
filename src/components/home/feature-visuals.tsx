import { HomeGradients } from "./effects";

/**
 * Abstract graphics for the feature rows, in navy / blue / silver gradients
 * with a soft glow. SVG only, decorative (aria-hidden).
 */

/** Research: layered rounded rectangles, the front one with lines of "notes". */
export function ResearchVisual() {
  return (
    <svg viewBox="0 0 400 320" className="h-auto w-full" aria-hidden>
      <HomeGradients id="rv" />
      <ellipse cx="210" cy="170" rx="170" ry="120" fill="url(#rv-glow)" />
      <rect x="70" y="92" width="190" height="190" rx="22" fill="url(#rv-blue)" opacity="0.35" />
      <rect x="110" y="66" width="190" height="190" rx="22" fill="url(#rv-blue)" opacity="0.6" />
      <rect
        x="150"
        y="40"
        width="190"
        height="190"
        rx="22"
        fill="#0D1117"
        stroke="url(#rv-silver)"
        strokeWidth="1.5"
      />
      <rect
        x="172"
        y="64"
        width="40"
        height="40"
        rx="10"
        fill="url(#rv-blue)"
        stroke="url(#rv-silver)"
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x="172"
          y={124 + i * 22}
          width={i % 2 ? 110 : 146}
          height="7"
          rx="3.5"
          fill={i === 0 ? "#C9D0D7" : "#A3ACB9"}
          fillOpacity={i === 0 ? 0.9 : 0.3}
        />
      ))}
    </svg>
  );
}

/** Search: flowing curved lines converging on a focus ring. */
export function SearchVisual() {
  const lines = [0, 1, 2, 3, 4, 5, 6];
  return (
    <svg viewBox="0 0 400 320" className="h-auto w-full" aria-hidden>
      <HomeGradients id="sv" />
      <ellipse cx="250" cy="150" rx="150" ry="110" fill="url(#sv-glow)" />
      {lines.map((i) => (
        <path
          key={i}
          d={`M10 ${60 + i * 34} C 120 ${70 + i * 30}, 170 ${150 + (i - 3) * 6}, 250 150`}
          fill="none"
          stroke="url(#sv-silver)"
          strokeOpacity={i === 3 ? 1 : 0.35}
          strokeWidth={i === 3 ? 2 : 1}
        />
      ))}
      <circle cx="250" cy="150" r="46" fill="#0D1117" stroke="url(#sv-silver)" strokeWidth="1.5" />
      <circle cx="250" cy="150" r="28" fill="none" stroke="#8FA4FF" strokeOpacity="0.5" />
      <circle cx="250" cy="150" r="7" fill="#F5F7FA" />
      <path d="M284 184 L 330 230" stroke="url(#sv-silver)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** Approve: concentric rings around a glowing check. */
export function ApproveVisual() {
  return (
    <svg viewBox="0 0 400 320" className="h-auto w-full" aria-hidden>
      <HomeGradients id="av" />
      <circle cx="200" cy="160" r="150" fill="url(#av-glow)" />
      {[56, 92, 128].map((r, i) => (
        <circle
          key={r}
          cx="200"
          cy="160"
          r={r}
          fill="none"
          stroke="url(#av-silver)"
          strokeOpacity={0.6 - i * 0.15}
          strokeDasharray={i === 1 ? "3 7" : undefined}
        />
      ))}
      {[
        [200 + 92 * Math.cos(-0.6), 160 + 92 * Math.sin(-0.6)],
        [200 + 128 * Math.cos(2.5), 160 + 128 * Math.sin(2.5)],
        [200 + 56 * Math.cos(1.2), 160 + 56 * Math.sin(1.2)],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 0 ? 6 : 4} fill={i === 0 ? "#8FA4FF" : "#C9D0D7"} />
      ))}
      <rect
        x="168"
        y="128"
        width="64"
        height="64"
        rx="18"
        fill="url(#av-blue)"
        stroke="url(#av-silver)"
      />
      <path
        d="M186 161 l10 10 l20 -23"
        fill="none"
        stroke="#F5F7FA"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

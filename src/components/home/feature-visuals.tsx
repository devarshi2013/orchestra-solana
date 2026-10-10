/**
 * Abstract graphics for the home page's feature rows: navy and gray shapes
 * drawn in SVG, no images and no data. Decorative (aria-hidden).
 * Colours come from the theme, so they follow light and dark mode.
 */

const NAVY = "var(--primary)";
const MUTED = "var(--muted-foreground)";
const LINE = "var(--border)";
const PAPER = "var(--background)";

/** Research: three layered sheets, the front one with lines of "notes". */
export function ResearchVisual() {
  const sheets = [
    { x: 46, y: 70, o: 0.25 },
    { x: 86, y: 46, o: 0.5 },
    { x: 126, y: 22, o: 1 },
  ];
  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full" aria-hidden>
      {sheets.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <rect
            width="170"
            height="210"
            rx="14"
            fill={i === 2 ? PAPER : NAVY}
            fillOpacity={i === 2 ? 1 : s.o * 0.9}
            stroke={i === 2 ? NAVY : "none"}
            strokeWidth="1.5"
          />
          {i === 2 && (
            <>
              <rect x="20" y="22" width="34" height="34" rx="8" fill={NAVY} />
              {[0, 1, 2, 3, 4].map((r) => (
                <rect
                  key={r}
                  x="20"
                  y={76 + r * 22}
                  width={r % 2 ? 96 : 128}
                  height="6"
                  rx="3"
                  fill={r === 0 ? NAVY : MUTED}
                  fillOpacity={r === 0 ? 1 : 0.35}
                />
              ))}
              <circle cx="146" cy="186" r="6" fill={NAVY} />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Search: a diamond of dots, with a ring picking out a few in navy. */
export function SearchVisual() {
  const dots: { x: number; y: number; on: boolean }[] = [];
  for (let r = -5; r <= 5; r++) {
    for (let c = -5; c <= 5; c++) {
      if (Math.abs(r) + Math.abs(c) > 6) continue;
      const x = 180 + (c - r) * 22;
      const y = 150 + (c + r) * 13;
      const near = Math.hypot(x - 214, y - 128) < 46;
      dots.push({ x, y, on: near });
    }
  }
  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full" aria-hidden>
      {dots.map((d, i) => (
        <ellipse
          key={i}
          cx={d.x}
          cy={d.y}
          rx="9"
          ry="5.5"
          fill={d.on ? NAVY : MUTED}
          fillOpacity={d.on ? 1 : 0.22}
        />
      ))}
      <circle cx="214" cy="128" r="52" fill="none" stroke={NAVY} strokeWidth="2" />
      <line
        x1="251"
        y1="165"
        x2="296"
        y2="210"
        stroke={NAVY}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Approve: concentric rings with nodes, around a navy square holding a check. */
export function ApproveVisual() {
  const nodes = [
    { r: 64, a: -40 },
    { r: 64, a: 150 },
    { r: 104, a: 20 },
    { r: 104, a: 220 },
    { r: 136, a: -100 },
    { r: 136, a: 95 },
  ];
  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full" aria-hidden>
      {[64, 104, 136].map((r) => (
        <circle
          key={r}
          cx="180"
          cy="150"
          r={r}
          fill="none"
          stroke={LINE}
          strokeWidth="1.5"
          strokeDasharray={r === 104 ? "3 6" : undefined}
        />
      ))}
      {nodes.map((n, i) => {
        const rad = (n.a * Math.PI) / 180;
        return (
          <circle
            key={i}
            cx={180 + n.r * Math.cos(rad)}
            cy={150 + n.r * Math.sin(rad)}
            r={i % 3 === 0 ? 9 : 6}
            fill={i % 3 === 0 ? NAVY : PAPER}
            stroke={i % 3 === 0 ? "none" : MUTED}
            strokeWidth="1.5"
          />
        );
      })}
      <rect x="148" y="118" width="64" height="64" rx="16" fill={NAVY} />
      <path
        d="M166 151 l9 9 l19 -21"
        fill="none"
        stroke={PAPER}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

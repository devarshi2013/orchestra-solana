/**
 * A handle on the page's smooth scroller (Lenis, set up in
 * src/components/layout/smooth-scroll.tsx), so components can scroll to a
 * position smoothly. Falls back to the browser's own scrolling when Lenis
 * isn't running (reduced motion).
 */
type Scroller = { scrollTo: (target: number, options?: { duration?: number }) => void };
let scroller: Scroller | null = null;

export function setSmoothScroller(next: Scroller | null) {
  scroller = next;
}

/** Scrolls the page to `y` (px from the top): smoothly with Lenis, instantly otherwise. */
export function scrollPageTo(y: number) {
  if (scroller) scroller.scrollTo(y, { duration: 0.9 });
  else window.scrollTo({ top: y });
}

"use client";

import Lenis from "lenis";
import { useEffect } from "react";

import "lenis/dist/lenis.css";

/**
 * Smooth page scrolling on every page (Lenis): gentle easing over ~1.1 s, and
 * same-page anchor links ("See how it works") glide to their section (landing
 * below the sticky navbar via the section's scroll-margin). Off when the
 * visitor prefers reduced motion (native scrolling then). Scrolling inside the
 * chat, dialogs, menus and other scrollable panels stays native.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.1,
      // easeOutExpo: quick to respond, soft to settle.
      easing: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
      autoRaf: true,
      anchors: true,
      allowNestedScroll: true,
      prevent: (node) =>
        Boolean(
          node.closest?.(
            "[data-chat-app], [data-lenis-prevent], [role=dialog], [role=listbox], [role=menu], .wallet-adapter-modal",
          ),
        ),
    });
    return () => lenis.destroy();
  }, []);
  return null;
}

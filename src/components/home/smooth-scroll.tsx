"use client";

import Lenis from "lenis";
import { useEffect } from "react";

import "lenis/dist/lenis.css";

/**
 * Smooth scrolling for the home page (Lenis): gentle easing over ~1.1 s, and
 * anchor links ("See how it works") glide to their section below the sticky
 * navbar. Off when the visitor prefers reduced motion (native scrolling then).
 * Home only: the chat has its own scrolling panels that Lenis would fight.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.1,
      // easeOutExpo: quick to respond, soft to settle.
      easing: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
      autoRaf: true,
      // Anchors land below the sticky navbar via each section's scroll-margin (scroll-mt-20).
      anchors: true,
      allowNestedScroll: true,
    });
    return () => lenis.destroy();
  }, []);
  return null;
}

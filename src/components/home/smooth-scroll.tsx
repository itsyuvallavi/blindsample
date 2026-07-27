"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll() {
  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const precisionPointer = window.matchMedia("(pointer: fine)");

    if (reducedMotion.matches || !precisionPointer.matches) {
      return;
    }

    const lenis = new Lenis({
      anchors: true,
      autoRaf: true,
      lerp: 0.075,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.85,
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  return null;
}

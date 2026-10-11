"use client";

import { RefObject, useEffect, useState } from "react";

/**
 * Progress (0–1) of an element moving through the viewport.
 * 0 when its top reaches `start` × viewport height, 1 when it reaches `end` × viewport height.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, start = 1, end = 0.5) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      const p = (start * vh - top) / ((start - end) * vh);
      setProgress(Math.min(1, Math.max(0, p)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ref, start, end]);

  return progress;
}

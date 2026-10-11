"use client";

import { RefObject, useEffect, useState } from "react";

/** True once the element has entered the viewport (stays true afterwards). */
export function useInView(ref: RefObject<HTMLElement | null>, rootMargin = "0px 0px -15% 0px") {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}

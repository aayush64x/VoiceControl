"use client";

import { useEffect, useRef, useState } from "react";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

/** Fades its children up the first time they scroll into view. */
export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Visible once its top has crossed 90% of the viewport. Checked on scroll as well as by the
    // observer: if the main thread is busy (e.g. the 3D hero) a fast scroll can carry an element
    // past the viewport between observer checks, and it would otherwise never be revealed.
    const check = () => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
        setVisible(true);
        cleanup();
      }
    };
    const observer = new IntersectionObserver(check, { rootMargin: "0px 0px -10% 0px" });
    const cleanup = () => {
      observer.disconnect();
      window.removeEventListener("scroll", check);
    };
    observer.observe(el);
    window.addEventListener("scroll", check, { passive: true });
    check();
    return cleanup;
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-visible={visible}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

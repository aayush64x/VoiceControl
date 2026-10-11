type MarqueeProps = {
  children: React.ReactNode;
  duration?: number;
  direction?: "left" | "right";
  className?: string;
  /** Pause in place while hovered or while something inside has keyboard focus. */
  pauseOnHover?: boolean;
};

/** Infinite horizontal ticker. Children are rendered twice so the loop is seamless. */
export function Marquee({ children, duration = 40, direction = "left", className = "", pauseOnHover = false }: MarqueeProps) {
  return (
    <div className={`mask-fade-x overflow-hidden ${pauseOnHover ? "marquee-pausable" : ""} ${className}`}>
      <div
        className="marquee-track"
        data-direction={direction}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        <div className="flex shrink-0">{children}</div>
        {/* inert keeps links in the visual duplicate out of the tab order */}
        <div className="flex shrink-0" aria-hidden="true" inert>
          {children}
        </div>
      </div>
    </div>
  );
}

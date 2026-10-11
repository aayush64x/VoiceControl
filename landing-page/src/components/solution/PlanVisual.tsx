import styles from "./solution.module.css";

// A tiny decision network: request → candidate readings → actions → result.
// The highlighted route matches the CSS motion path in solution.module.css (.pulse).
const NODES = [
  { id: "in", x: 14, y: 60, d: 0, path: true },
  { id: "a1", x: 84, y: 22, d: 0.15 },
  { id: "a2", x: 84, y: 60, d: 0.2, path: true },
  { id: "a3", x: 84, y: 98, d: 0.25 },
  { id: "b1", x: 156, y: 36, d: 0.35, path: true },
  { id: "b2", x: 156, y: 84, d: 0.4 },
  { id: "out", x: 222, y: 60, d: 0.5, path: true },
];
const EDGES = [
  ["in", "a1"], ["in", "a2"], ["in", "a3"],
  ["a1", "b1"], ["a2", "b1"], ["a2", "b2"], ["a3", "b2"],
  ["b1", "out"], ["b2", "out"],
];
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
// When each node on the route lights up, as the pulse reaches it (pulse runs 0.9s → 2.0s)
const LIT_AT: Record<string, number> = { in: 0.9, a2: 1.2, b1: 1.6, out: 2.0 };

// Illustrative step labels, not live agent output.
const STEPS = ["Identify fields", "Prepare actions"];

/** Card 02: nodes connect, light travels the chosen route, and the resulting plan appears. */
export function PlanVisual() {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <svg viewBox="0 0 236 120" className="h-[110px] w-[236px] overflow-visible" aria-hidden="true">
        {EDGES.map(([from, to]) => {
          const a = byId[from];
          const b = byId[to];
          return (
            <line
              key={from + to}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              strokeWidth="1"
              className={`${styles.netLine} ${styles.anim}`}
              style={{ "--d": `${b.d}s` } as React.CSSProperties}
            />
          );
        })}
        {/* Chosen route, drawn in lavender */}
        <path
          d="M14 60 L84 60 L156 36 L222 60"
          fill="none"
          stroke="#c8b8fa"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${styles.netPath} ${styles.anim}`}
        />
        {NODES.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={n.id === "in" || n.id === "out" ? 6 : 4.5}
            fill="rgba(255,255,255,0.55)"
            className={`${styles.netNode} ${n.path ? styles.netPathNode : ""} ${styles.anim}`}
            style={{ "--d": `${n.d}s`, "--lit": `${LIT_AT[n.id] ?? 0}s` } as React.CSSProperties}
          />
        ))}
        {/* Travelling light */}
        <circle r="3.5" fill="#fff" className={`${styles.pulse} ${styles.anim}`} style={{ filter: "drop-shadow(0 0 6px #c8b8fa)" }} />
      </svg>

      <div className="flex items-center gap-2 text-[12px] text-white">
        {STEPS.map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            {i > 0 && (
              <span
                className={`${styles.planStep} ${styles.anim} text-[#c8b8fa]`}
                style={{ "--d": `${2.15 + i * 0.25 - 0.12}s` } as React.CSSProperties}
              >
                →
              </span>
            )}
            <span
              className={`${styles.glass} ${styles.planStep} ${styles.anim} rounded-full px-3 py-[7px] leading-none`}
              style={{ "--d": `${2.15 + i * 0.25}s` } as React.CSSProperties}
            >
              {step}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

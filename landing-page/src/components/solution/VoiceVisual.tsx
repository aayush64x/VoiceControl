import styles from "./solution.module.css";

const BAR_COUNT = 31;
const COMMAND = "“Fill out this form.”"; // 21 characters, matches the typing animation (type-21)

// Deterministic "speech" envelope: quiet beside the orb, livelier mid-way out, tapering at the edges.
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = i / (BAR_COUNT - 1);
  const envelope = Math.pow(Math.sin(Math.PI * t), 0.6);
  const texture = 0.5 + 0.5 * Math.abs(Math.sin(i * 2.1));
  const hi = 0.16 + 0.84 * envelope * texture;
  return {
    hi: hi.toFixed(2),
    lo: (hi * 0.3).toFixed(2),
    mid: (hi * 0.7).toFixed(2),
    delay: `${(-((i * 0.37) % 1.4)).toFixed(2)}s`,
  };
});

/** Card 01: a small glass orb, a waveform opening out from it, and the spoken command typing in. */
export function VoiceVisual() {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="relative flex h-[76px] w-[236px] items-center justify-center">
        <div className={`${styles.waveform} ${styles.anim} flex h-full w-full items-center justify-between`}>
          {BARS.map((bar, i) => (
            <span
              key={i}
              className={`${styles.bar} ${styles.anim} block h-[64px] w-[3px] rounded-full`}
              style={
                { "--hi": bar.hi, "--lo": bar.lo, "--mid": bar.mid, animationDelay: bar.delay } as React.CSSProperties
              }
            />
          ))}
        </div>
        {/* Glass orb sitting on the waveform */}
        <span className="absolute size-[60px] rounded-full bg-ink-soft" />
        <span className={`${styles.orbHalo} ${styles.anim} absolute size-[60px] rounded-full border border-[#c8b8fa]/60`} />
        <span className={`${styles.orb} ${styles.anim} absolute size-[56px] rounded-full`} />
      </div>

      <p
        className={`${styles.glass} ${styles.command} ${styles.anim} flex h-[34px] items-center rounded-full px-4 font-mono text-[12px] tracking-normal text-white`}
      >
        <span className={`${styles.commandText} ${styles.anim} inline-block overflow-hidden whitespace-nowrap`}>
          {COMMAND}
        </span>
        <span className={`${styles.commandCaret} ${styles.anim} ml-[2px] h-[14px] w-px bg-[#c8b8fa]`} />
      </p>
    </div>
  );
}

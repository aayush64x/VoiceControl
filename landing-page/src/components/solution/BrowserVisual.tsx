import styles from "./solution.module.css";

/**
 * Card 03: a miniature, clearly illustrative browser. The cursor moves to a field, sample text is
 * typed, the button is pressed and a checkmark confirms. Pure CSS, no real page or backend.
 */
export function BrowserVisual() {
  return (
    <div className="relative h-[156px] w-[236px] overflow-hidden rounded-[14px] bg-white/[0.06] text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_12px_30px_-12px_rgba(62,83,111,0.6)] backdrop-blur-[4px]">
      {/* Window chrome */}
      <div className="flex h-6 items-center gap-[5px] border-b border-white/10 px-[10px]">
        <span className="size-[6px] rounded-full bg-white/30" />
        <span className="size-[6px] rounded-full bg-white/20" />
        <span className="size-[6px] rounded-full bg-white/15" />
        <span className="ml-2 flex h-[14px] flex-1 items-center rounded-full bg-white/10 px-2 text-[8px] text-white/50">
          example.org/form
        </span>
        <span className="text-[8px] uppercase tracking-[0.06em] text-white/40">Example</span>
      </div>

      {/* Page body */}
      <div className="px-[14px] pt-[12px]">
        <span className="block text-[9px] text-white/60">Full name</span>
        <div
          className={`${styles.field} ${styles.anim} mt-[4px] flex h-[26px] items-center rounded-[8px] bg-white/[0.07] px-2`}
        >
          <span
            className={`${styles.typed} ${styles.anim} inline-block overflow-hidden whitespace-nowrap font-mono text-[11px] text-white`}
          >
            Jordan Lee
          </span>
          <span className={`${styles.caret} ${styles.anim} ml-px h-[12px] w-px bg-[#c8b8fa]`} />
        </div>

        <div className="mt-[12px] flex items-center justify-between">
          <span
            className={`${styles.submit} ${styles.anim} flex h-[24px] items-center rounded-full px-3 text-[10px] font-medium text-ink`}
          >
            Continue
          </span>
          <span
            className={`${styles.done} ${styles.anim} flex items-center gap-1 rounded-full bg-[#c8b8fa]/20 px-2 py-[3px] text-[10px] text-white`}
          >
            <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
              <path d="M3.3 8.3 6.6 11.5 12.7 4.8" stroke="#c8b8fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Done
          </span>
        </div>
      </div>

      {/* Cursor (tip at the element's top-left) */}
      <svg
        viewBox="0 0 16 20"
        className={`${styles.cursor} ${styles.anim} absolute left-0 top-0 h-[18px] w-[14px] drop-shadow-[0_2px_3px_rgba(62,83,111,0.5)]`}
        aria-hidden="true"
      >
        <path d="M1 1v15l4-4 3 7 3-1.4-3-6.6h6z" fill="#fff" stroke="#2c3b52" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

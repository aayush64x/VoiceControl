"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ROUTES, STAGES, type Stage } from "./tech/stages";
import styles from "./tech/tech.module.css";
import { Reveal } from "./ui/Reveal";
import { SectionHeader } from "./ui/SectionHeader";
import { useInView } from "./ui/useInView";

/** How many stages are "reached": grows as the flow column scrolls up past 60% of the viewport. */
function useActiveStages(ref: React.RefObject<HTMLElement | null>, count: number) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = (window.innerHeight * 0.6 - rect.top) / rect.height;
      setActive(Math.max(0, Math.min(count, Math.ceil(progress * count))));
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
  }, [ref, count]);
  return active;
}

function Chip({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-[10px] py-[5px] text-[12px] leading-none ${
        accent ? "bg-white/20 text-white" : "bg-white text-muted shadow-[inset_0_0_0_1px_rgba(62,83,111,0.06)]"
      }`}
    >
      {children}
    </span>
  );
}

// Waveform shape for the Speech Recognition panel
const BARS = Array.from({ length: 17 }, (_, i) => {
  const t = i / 16;
  const envelope = Math.sin(Math.PI * t);
  const hi = 0.35 + 0.65 * envelope * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.9)));
  return { hi: hi.toFixed(2), lo: (hi * 0.45).toFixed(2), mid: (hi * 0.7).toFixed(2), d: `${(-(i % 5) * 0.08).toFixed(2)}s` };
});
const TRANSCRIPT = "“Fill out this form with my information.”"; // 41 characters (matches .transcript)

/** Only the Speech Recognition stage animates audio: waveform first, then the transcript types in. */
function SpeechPanel() {
  return (
    <div
      className="mt-4 overflow-hidden rounded-[24px] bg-ink-soft p-3 shadow-[inset_0_0_24px_0_rgba(255,255,255,0.18),inset_0_0_6px_0_rgba(255,255,255,0.5)] tab:p-5"
      role="img"
      aria-label="Illustration: a voice waveform followed by the transcript “Fill out this form with my information.”"
    >
      <div className="flex items-center justify-between" aria-hidden="true">
        <span className="flex items-center gap-2 text-[13px] text-white/80">
          <span className={`${styles.listening} ${styles.anim} size-[6px] rounded-full bg-[#c8b8fa]`} />
          Speech to text
        </span>
        <span className="rounded-full bg-white/10 px-[10px] py-[4px] text-[11px] text-white/80">Google API</span>
      </div>
      <div className="mt-3 flex h-[56px] items-center justify-center gap-[5px]" aria-hidden="true">
        {BARS.map((bar, i) => (
          <span
            key={i}
            className={`${styles.bar} ${styles.anim} block h-full w-[4px] rounded-full`}
            style={{ "--hi": bar.hi, "--lo": bar.lo, "--mid": bar.mid, "--d": bar.d } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="mt-3 rounded-[14px] bg-white/[0.07] px-4 py-3" aria-hidden="true">
        <span className="block text-[10px] uppercase tracking-[0.06em] text-white/45">Transcript</span>
        <p className="mt-1 flex items-center font-mono text-[10px] text-white tab:text-[13px]">
          <span className={`${styles.transcript} ${styles.anim} inline-block overflow-hidden whitespace-nowrap`}>
            {TRANSCRIPT}
          </span>
          <span className={`${styles.caret} ${styles.anim} ml-[2px] h-[14px] w-px bg-[#c8b8fa]`} />
        </p>
      </div>
    </div>
  );
}

function StageCard({ stage, index, active }: { stage: Stage; index: number; active: boolean }) {
  return (
    <article data-active={active} className={`${styles.card} card-raised rounded-[32px] p-5 tab:p-6`}>
      <div className="flex items-start gap-4">
        <span className={`${styles.tile} flex size-12 shrink-0 items-center justify-center rounded-[18px]`}>
          {stage.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[18px] font-medium leading-[1.25] text-white">{stage.title}</h3>
            <span className="text-[12px] font-medium text-white/50">{String(index + 1).padStart(2, "0")}</span>
          </div>
          <p className="mt-1 text-[14px] leading-[1.4] text-white/75">{stage.body}</p>
        </div>
      </div>

      {stage.id === "input" && (
        <div className="mt-4 grid grid-cols-1 gap-2 tab:grid-cols-2">
          <span className="flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[14px] text-white">
            <span className="size-[6px] rounded-full bg-[#c8b8fa]" />
            Voice
            <span className="ml-auto text-[11px] text-white/50">Alt+Shift+V</span>
          </span>
          <span className="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[14px] text-ink shadow-[inset_0_0_0_1px_rgba(62,83,111,0.08)]">
            <span className="size-[6px] rounded-full bg-grey" />
            Text
            <span className="ml-auto text-[11px] text-ink/40">Side panel</span>
          </span>
        </div>
      )}

      {stage.id === "speech" && <SpeechPanel />}

      {stage.id === "routing" && (
        <ul className="mt-4 grid grid-cols-1 gap-2 tab:grid-cols-3">
          {ROUTES.map((route, i) => (
            <li key={route.name} className="rounded-[16px] bg-white px-3 py-[10px] shadow-[inset_0_0_0_1px_rgba(62,83,111,0.05)]">
              <div className="flex items-center gap-2">
                <span className={`size-[6px] rounded-full ${i === 0 ? "bg-grey" : "bg-[#c8b8fa]"}`} />
                <span className="text-[13px] font-medium text-ink">{route.name}</span>
              </div>
              <p className="mt-1 text-[11px] leading-[1.35] text-muted">
                {route.detail} · {route.example}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-[6px]">
        {stage.chips.map((chip, i) => (
          <Chip key={chip} accent={i === 0}>
            {chip}
          </Chip>
        ))}
        {stage.skipNote && (
          <span className="inline-flex items-center rounded-full border border-dashed border-white/40 px-[10px] py-[4px] text-[11px] text-white/80 tab:hidden">
            {stage.skipNote}
          </span>
        )}
        <span className="ml-auto text-[11px] uppercase tracking-[0.02em] text-white/60">Runs in {stage.runsIn}</span>
      </div>
    </article>
  );
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <div className="flex justify-center" aria-hidden="true">
      <span data-filled={filled} className={`${styles.connector} relative block h-10 w-[2px] rounded-full`}>
        <span className={`${styles.connectorFill} absolute inset-0 rounded-full`} />
        <span
          className={`${styles.pulse} ${styles.anim} absolute -left-[3px] size-2 rounded-full bg-white shadow-[0_0_8px_2px_rgba(200,184,250,0.9)]`}
        />
      </span>
    </div>
  );
}

/**
 * Dashed bypass rail beside the column (tablet and up). It spans from the source card to the
 * destination card, with short stubs pointing into each, and a label in the middle.
 */
function BypassRail({ side, rows, label }: { side: "left" | "right"; rows: string; label: string }) {
  const isLeft = side === "left";
  return (
    <div
      className={`${styles.rail} ${styles.anim} relative hidden tab:block`}
      style={{ gridRow: rows, gridColumn: isLeft ? 1 : 3 }}
      aria-hidden="true"
    >
      <span
        className={`absolute bottom-[56px] top-[56px] w-6 border-y border-dashed border-ink/30 ${
          isLeft ? "right-0 border-l rounded-l-[14px]" : "left-0 border-r rounded-r-[14px]"
        }`}
      />
      {/* Arrowhead into the destination card */}
      <svg
        viewBox="0 0 10 10"
        className={`absolute bottom-[51px] size-[10px] text-ink/35 ${isLeft ? "-right-[3px]" : "-left-[3px] rotate-180"}`}
      >
        <path d="M2 1.5 7 5 2 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        className={`absolute top-1/2 w-[112px] -translate-y-1/2 rounded-[12px] bg-white px-2 py-[6px] text-center text-[11px] leading-[1.3] text-muted shadow-[inset_0_0_0_1px_rgba(62,83,111,0.08)] ${
          isLeft ? "right-2" : "left-2"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function TechnologySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef);
  const active = useActiveStages(flowRef, STAGES.length);

  return (
    <section
      ref={sectionRef}
      id="technology"
      data-inview={inView}
      className={`${styles.section} bg-white px-5 py-[72px] tab:px-10 tab:py-[100px] desk:px-20`}
    >
      <SectionHeader
        index="005"
        label="Tech Stack"
        title="Technology Ecosystem"
        subtitle="How a sentence becomes clicks: five stages from your voice to the browser."
      />

      <Reveal className="mx-auto mt-12 max-w-[960px] tab:mt-[80px]">
        {/* Grid rows alternate card / connector: cards sit on rows 1, 3, 5, 7, 9 */}
        <div
          ref={flowRef}
          className="grid grid-cols-1 tab:grid-cols-[132px_minmax(0,1fr)_132px]"
        >
          {STAGES.map((stage, i) => (
            <Fragment key={stage.id}>
              <div className="tab:col-start-2" style={{ gridRow: i * 2 + 1 }}>
                <StageCard stage={stage} index={i} active={i < active} />
              </div>
              {i < STAGES.length - 1 && (
                <div className="tab:col-start-2" style={{ gridRow: i * 2 + 2 }}>
                  <Connector filled={i + 1 < active} />
                </div>
              )}
            </Fragment>
          ))}
          {/* Your Command → Command Routing, skipping Speech Recognition */}
          <BypassRail side="left" rows="1 / 6" label="Typed commands skip speech recognition" />
          {/* Command Routing → Browser Actions, skipping the AI Agent */}
          <BypassRail side="right" rows="5 / 10" label="Direct commands skip the AI agent" />
        </div>
      </Reveal>

      {/* Transport between the two halves */}
      <div className="mx-auto mt-12 flex max-w-[960px] flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[14px] text-muted">
        <Chip>Chrome extension</Chip>
        <span aria-hidden="true">⇄</span>
        <Chip accent>WebSocket · localhost:8765</Chip>
        <span aria-hidden="true">⇄</span>
        <Chip>Python backend</Chip>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import styles from "./solution.module.css";
import { asset } from "@/lib/asset";

type StepCardProps = {
  index: number;
  title: string;
  body: string;
  /** Short description of the illustration for screen readers. */
  visualLabel: string;
  children: React.ReactNode;
};

/**
 * Light raised card with a dark, dotted display panel on top. Shared by the three Solution steps.
 * Hovering remounts the visual, which replays its one-shot animation from the start.
 */
export function StepCard({ index, title, body, visualLabel, children }: StepCardProps) {
  const [run, setRun] = useState(0);

  return (
    <article
      onMouseEnter={() => setRun((n) => n + 1)}
      className={`${styles.card} card-raised mx-auto flex h-full w-full max-w-[400px] flex-col items-center rounded-[120px_120px_80px_80px] p-4 pb-10 text-center`}
    >
      <div
        role="img"
        aria-label={visualLabel}
        className={`${styles.panel} relative flex h-[228px] w-full items-center justify-center overflow-hidden rounded-[104px_104px_56px_56px] bg-ink-soft shadow-[inset_0_0_40px_0_rgba(255,255,255,0.4),inset_0_0_12px_0_#fff,inset_0_-2px_2px_0_#1d2838] desk:aspect-square desk:h-auto`}
      >
        <span
          className="absolute inset-0 bg-cover opacity-20"
          style={{ backgroundImage: `url(${asset("/media/dot-pattern.svg")})` }}
          aria-hidden="true"
        />
        <span className={`${styles.glow} absolute inset-[12%] rounded-full`} aria-hidden="true" />
        <div
          key={run}
          className="relative flex h-full w-full items-center justify-center px-6 pb-8 tab:max-desk:scale-[0.82]"
          aria-hidden="true"
        >
          {children}
        </div>
        <span className="absolute bottom-0 left-1/2 flex h-[38px] min-w-8 -translate-x-1/2 items-center justify-center rounded-t-[10px] bg-[linear-gradient(180deg,rgba(255,255,255,0.3)_0%,rgba(255,255,255,0)_100%)] px-2 text-[16px] leading-[1.35] text-white backdrop-blur-[5px]">
          {String(index).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-6 text-[20px] font-medium leading-[1.35] text-white">{title}</h3>
      <p className="mt-2 max-w-[269px] text-[16px] leading-[1.35] text-white/75">{body}</p>
    </article>
  );
}

"use client";

import { useRef } from "react";
import { Marquee } from "./ui/Marquee";
import { Reveal } from "./ui/Reveal";
import { SectionBadge } from "./ui/SectionBadge";
import { Play } from "./ui/icons";
import { useScrollProgress } from "./ui/useScrollProgress";
import { asset } from "@/lib/asset";

const STATEMENT =
  "The web isn't accessible to everyone. Traditional browsing depends on clicking, scrolling, and typing.";

// Ticker behind the video: the answer to the problem above. Messages, not metrics,
// so nothing here claims numbers we haven't measured.
const STATS = [
  { value: "No mouse", label: "needed" },
  { value: "No keyboard", label: "required" },
  { value: "Just", label: "say the goal" },
];

export function ProblemSection() {
  const textRef = useRef<HTMLParagraphElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const textProgress = useScrollProgress(textRef, 0.85, 0.35);
  const bandProgress = useScrollProgress(bandRef, 0.9, 0.3);

  const words = STATEMENT.split(" ");

  return (
    <section className="relative overflow-hidden bg-white pb-[120px] pt-[72px] tab:pt-[104px] desk:pt-[120px]">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4 px-5 tab:px-10 desk:px-20">
        <Reveal>
          <SectionBadge index="001" label="The Problem" />
        </Reveal>
        <p
          ref={textRef}
          className="max-w-[880px] text-center text-[32px] leading-[36px] tracking-[-1.5px] tab:text-[48px] tab:leading-[52px]"
        >
          {words.map((word, i) => {
            const lit = textProgress * words.length > i;
            return (
              <span
                key={i}
                className="transition-colors duration-300"
                style={{ color: lit ? "var(--ink)" : "rgba(62,83,111,0.14)" }}
              >
                {word}{" "}
                {/* Match the reference's line break on wide screens */}
                {(word === "to" || word === "depends") && <br className="hidden desk:inline" />}
              </span>
            );
          })}
        </p>
      </div>

      {/* Stats ticker with the media pill on top */}
      <div ref={bandRef} className="relative mt-[60px] flex h-[240px] items-center tab:mt-[125px] tab:h-[400px]">
        <Marquee duration={45} className="w-full">
          {STATS.map((stat) => (
            <div
              key={stat.value}
              className="mr-[110px] flex shrink-0 items-baseline gap-[17px] whitespace-nowrap text-[64px] font-semibold uppercase leading-none tracking-[-0.08em] tab:mr-[220px] tab:text-[114px]"
            >
              <span className="text-ink">{stat.value}</span>
              <span className="text-grey">{stat.label}</span>
            </div>
          ))}
        </Marquee>

        <a
          href="#interface"
          aria-label="Watch the product video"
          className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[104px]"
          style={{
            width: `min(${526 + 74 * bandProgress}px, calc(100% - 40px))`,
            height: `${161 + 239 * bandProgress}px`,
          }}
        >
          <video
            poster={asset("/media/problem-video-poster.jpg")}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={asset("/media/problem-video.mp4")} type="video/mp4" />
            <source src={asset("/media/problem-video.webm")} type="video/webm" />
          </video>
          <span className="absolute inset-0 rounded-[104px] bg-ink/15 shadow-[inset_0_0_40px_0_#fff]" />
          <span
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
            style={{ width: 65 + 15 * bandProgress, height: 32 + 48 * bandProgress }}
          >
            <Play className="size-4" />
          </span>
        </a>
      </div>
    </section>
  );
}

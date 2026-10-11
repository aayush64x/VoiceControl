"use client";

import { useRef } from "react";
import { SectionHeader } from "./ui/SectionHeader";
import { useScrollProgress } from "./ui/useScrollProgress";
import { asset } from "@/lib/asset";

const STEPS = [
  {
    title: "Speak",
    body: "Type your goal in plain language. Voice input is coming soon.",
    icon: asset("/media/process-1.svg"),
  },
  {
    title: "Understand",
    body: "The agent reads the page and plans the steps to get there.",
    icon: asset("/media/process-2.svg"),
  },
  {
    title: "Act",
    body: "It clicks, types, and scrolls for you, checking the page after each step.",
    icon: asset("/media/process-3.svg"),
  },
  {
    title: "Complete",
    body: "The task is done, and the side panel shows what happened.",
    icon: asset("/media/process-4.svg"),
  },
];

function StepIcon({ src, n, active }: { src: string; n: number; active: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`flex size-20 shrink-0 items-center justify-center rounded-[28px] transition-colors duration-500 ${
          active
            ? "bg-muted shadow-[inset_0_0_12px_0_#fff]"
            : "bg-surface shadow-[inset_0_0_12px_0_rgba(62,83,111,0.12)]"
        }`}
      >
        <span
          className={`size-[34px] transition-colors duration-500 ${active ? "bg-white" : "bg-ink"}`}
          style={{ mask: `url(${src}) center / contain no-repeat`, WebkitMask: `url(${src}) center / contain no-repeat` }}
        />
      </span>
      <span
        className={`hidden size-8 items-center justify-center rounded-[12px] text-[16px] leading-[1.35] text-ink transition-colors duration-500 tab:flex ${
          active ? "bg-white" : "bg-surface"
        }`}
      >
        {String(n).padStart(2, "0")}
      </span>
    </div>
  );
}

function Marker({ active }: { active: boolean }) {
  return (
    <span className="relative z-20 flex size-9 shrink-0 items-center justify-center">
      {active ? (
        <span className="flex size-9 items-center justify-center rounded-[12px] bg-[linear-gradient(270deg,var(--rainbow))]">
          <span className="flex size-[30px] items-center justify-center rounded-[8px] bg-[radial-gradient(70.7%_70.7%,#aec4ff_0%,#a9dfff_25%,#e7e5ff_50%,#d4f1ff_75%,#c8b8fa_100%)]">
            <span className="size-[10px] rounded-full bg-ink" />
          </span>
        </span>
      ) : (
        <span className="size-[21px] rounded-[6px] border border-ink/10 bg-white" />
      )}
    </span>
  );
}

export function HowItWorksSection() {
  const listRef = useRef<HTMLOListElement>(null);
  // 0 when the list top hits 60% of the viewport, 1 when the list has scrolled up past it.
  const progress = useScrollProgress(listRef, 0.6, -0.15);
  const activeCount = Math.max(1, Math.ceil(progress * STEPS.length));

  return (
    <section id="process" className="bg-white px-5 py-[72px] tab:px-10 tab:py-[100px]">
      <SectionHeader
        index="003"
        label="Process"
        title="How It Works"
        subtitle="From one sentence to a finished task. The agent handles every click in between."
      />

      <ol ref={listRef} className="relative mx-auto mt-12 flex max-w-[1040px] flex-col gap-4 tab:mt-[80px]">
        {/* Timeline */}
        <span
          className="absolute bottom-[50px] left-[38px] top-[80px] z-10 w-px bg-sky tab:left-1/2 tab:-translate-x-1/2"
          aria-hidden="true"
        />
        <span
          className="absolute left-[37px] top-[80px] z-10 w-[3px] bg-[linear-gradient(180deg,var(--rainbow))] transition-[height] duration-300 tab:left-1/2 tab:-translate-x-1/2"
          style={{ height: `calc((100% - 130px) * ${progress})` }}
          aria-hidden="true"
        />

        {STEPS.map((step, i) => {
          const active = i < activeCount;
          const textFirst = i % 2 === 1;
          const text = (
            <div className={`max-w-[320px] ${textFirst ? "tab:text-right" : ""}`}>
              <h3 className={`text-[20px] font-medium leading-[1.35] transition-colors duration-500 ${active ? "text-white" : "text-ink"}`}>
                {step.title}
              </h3>
              <p className={`mt-1 text-[16px] leading-[1.35] transition-colors duration-500 ${active ? "text-white/75" : "text-muted"}`}>
                {step.body}
              </p>
            </div>
          );
          const icon = <StepIcon src={step.icon} n={i + 1} active={active} />;

          return (
            <li
              key={step.title}
              className="relative isolate flex min-h-[160px] items-center gap-4 rounded-[48px] px-5 tab:grid tab:grid-cols-[1fr_36px_1fr] tab:gap-[62px] tab:px-0"
            >
              {/* Card surface fades in once the step is reached (a gradient can't transition as a colour) */}
              <span
                className={`card-raised absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-500 ${active ? "opacity-100" : "opacity-0"}`}
                aria-hidden="true"
              />
              {/* Phone: marker, icon, text. Tablet+: zig-zag around the centre line. */}
              <div className={`${textFirst ? "order-3" : "order-2"} tab:order-none tab:flex tab:justify-end`}>
                {textFirst ? text : icon}
              </div>
              <div className="order-1 tab:order-none">
                <Marker active={active} />
              </div>
              <div className={`${textFirst ? "order-2" : "order-3"} tab:order-none`}>{textFirst ? icon : text}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

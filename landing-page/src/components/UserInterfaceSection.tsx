"use client";

import { useState } from "react";
import { asset } from "@/lib/asset";
import { EXTENSION_URL } from "@/lib/links";
import { ArrowRight, Chevron } from "./ui/icons";
import { PrimaryButton } from "./ui/PrimaryButton";
import { Reveal } from "./ui/Reveal";
import { SectionHeader } from "./ui/SectionHeader";

// Each slide shows the REAL VOYA side panel (public/extension-ui/, the same files
// as the extension) at one moment of a benefits check, with sample content.
// Pressing the panel's button plays the whole example.
const SLIDES = [
  {
    scene: "idle",
    title: "One button does everything",
    body: "Press it to talk, press it again when you’re done. Or tap Control twice from any web page. It does the same thing in every state, in the same place.",
    facts: [
      { value: "1", label: "Button" },
      { value: "Ctrl ×2", label: "From any page" },
      { value: "Stop", label: "Any time" },
    ],
  },
  {
    scene: "ask",
    title: "It reads you the question",
    body: "Form questions are read aloud with their options. Say the answer, or just its number. Nothing about you is saved: every form asks fresh.",
    facts: [
      { value: "Voice", label: "Answers" },
      { value: "“Four”", label: "Picks option 4" },
      { value: "0", label: "Details stored" },
    ],
  },
  {
    scene: "working",
    title: "Every step, live",
    body: "Each Strands tool call appears as it happens, in plain words with the tool name beside it, so you always know what VOYA is doing.",
    facts: [
      { value: "Live", label: "Step list" },
      { value: "Strands", label: "Agents SDK" },
      { value: "Bedrock", label: "Claude models" },
    ],
  },
  {
    scene: "confirm",
    title: "Nothing is sent without your yes",
    body: "A Strands hook holds every Submit, Send or Pay click until you say yes. Say “cancel” and nothing is sent. It's enforced in code, not just in the prompt.",
    facts: [
      { value: "Hook", label: "Enforced in code" },
      { value: "Yes", label: "To submit" },
      { value: "No", label: "Nothing sent" },
    ],
  },
  {
    scene: "done",
    title: "Answers from the page itself",
    body: "VOYA reports only what the page says, never guesses, and shows Strands’ own numbers for the task: model calls, tools, tokens and cache hits.",
    facts: [
      { value: "SSDI", label: "From the page" },
      { value: "86%", label: "Cached" },
      { value: "19", label: "Model calls" },
    ],
  },
];

function ArrowButton({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Previous slide" : "Next slide"}
      className="flex size-12 items-center justify-center rounded-full bg-ink text-white shadow-[inset_0_0_8px_0_rgba(255,255,255,0.8)] transition-transform hover:scale-105"
    >
      <Chevron direction={direction} className="size-6" />
    </button>
  );
}

export function UserInterfaceSection() {
  const [index, setIndex] = useState(0);
  const go = (delta: number) => setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);

  return (
    <section id="interface" className="overflow-hidden bg-white px-5 py-[72px] tab:px-10 tab:py-[100px]">
      <SectionHeader index="004" label="User Interface" title="Meet the VOYA side panel" />

      <Reveal className="relative mx-auto mt-12 max-w-[1040px] tab:mt-[80px]">
        <div className="relative h-[1080px] tab:h-[620px]">
          {SLIDES.map((slide, i) => {
            const offset = ((i - index + SLIDES.length + 1) % SLIDES.length) - 1; // -1, 0, 1
            const active = offset === 0;
            return (
              <article
                key={slide.title}
                aria-hidden={!active}
                className="absolute inset-x-0 top-0 mx-auto flex h-full max-w-[912px] flex-col gap-6 card-raised rounded-[48px] p-2 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] tab:flex-row tab:gap-[48px] tab:rounded-[64px]"
                style={{
                  transform: `translateX(calc(${offset} * (100% + 120px))) scale(${active ? 1 : 0.8})`,
                  opacity: active ? 1 : offset === 1 ? 0.6 : 0,
                  pointerEvents: active ? "auto" : "none",
                }}
              >
                <div className="relative h-[620px] shrink-0 overflow-hidden rounded-[40px] bg-[#f5f9fc] tab:h-full tab:w-[400px] tab:rounded-[56px]">
                  {/* Only the visible slide runs the live panel (one 3D mascot at a time) */}
                  {active && (
                    <iframe
                      key={slide.scene}
                      src={asset(`/extension-ui/index.html?scene=${slide.scene}`)}
                      title={`VOYA side panel: ${slide.title}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col px-4 pb-6 tab:py-10 tab:pr-12 tab:pl-0">
                  <div className="flex items-center gap-2">
                    <img src={asset("/media/logo-mark.svg")} alt="" className="size-7 rounded-full bg-ink p-1" />
                    <span className="text-[18px] font-semibold tracking-[-0.04em] text-white">VOYA</span>
                  </div>
                  <h3 className="mt-10 text-[32px] font-medium leading-[1.2] tracking-[-0.03em] text-white">
                    {slide.title}
                  </h3>
                  <p className="mt-4 text-[16px] leading-[1.35] text-white/75">{slide.body}</p>
                  <a href="#technology" className="group mt-6 flex w-fit items-center gap-2 text-[16px] font-semibold text-white">
                    How it works
                    <span className="flex size-6 items-center justify-center rounded-full bg-grey text-white transition-transform group-hover:translate-x-1">
                      <ArrowRight className="size-4" />
                    </span>
                  </a>
                  <dl className="mt-auto grid grid-cols-3 gap-4 pt-8 tab:grid-cols-[repeat(3,124px)]">
                    {slide.facts.map((fact) => (
                      <div key={fact.label} className="flex flex-col-reverse">
                        <dt className="mt-[5px] text-[16px] leading-[1.35] text-white/75">{fact.label}</dt>
                        <dd className="text-[24px] font-medium leading-[1.1] tracking-[-0.03em] text-white tab:text-[32px]">
                          {fact.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center gap-4 tab:pointer-events-none tab:absolute tab:inset-x-0 tab:top-1/2 tab:mt-0 tab:-translate-y-1/2 tab:justify-between">
          <span className="tab:pointer-events-auto">
            <ArrowButton direction="left" onClick={() => go(-1)} />
          </span>
          <span className="tab:pointer-events-auto">
            <ArrowButton direction="right" onClick={() => go(1)} />
          </span>
        </div>
      </Reveal>

      <p className="mx-auto mt-8 max-w-[640px] text-center text-[16px] leading-[1.35] text-muted">
        This is the real VOYA side panel, running here in demo mode with sample content. Press its button to play an
        example. In Chrome, VOYA hears you and does the clicks.
      </p>

      <div id="get-extension" className="mt-[48px] flex justify-center">
        <PrimaryButton href={EXTENSION_URL}>Get Extension</PrimaryButton>
      </div>
    </section>
  );
}

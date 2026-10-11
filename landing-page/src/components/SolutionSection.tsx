"use client";

import { useRef } from "react";
import { BrowserVisual } from "./solution/BrowserVisual";
import { PlanVisual } from "./solution/PlanVisual";
import { StepCard } from "./solution/StepCard";
import { VoiceVisual } from "./solution/VoiceVisual";
import styles from "./solution/solution.module.css";
import { Reveal } from "./ui/Reveal";
import { SectionHeader } from "./ui/SectionHeader";
import { useInView } from "./ui/useInView";

const STEPS = [
  {
    title: "Say the Goal",
    body: "Describe what you want done in plain language. No mouse required.",
    visualLabel: "Illustration: a glass orb with a voice waveform, and the command “Fill out this form.”",
    Visual: VoiceVisual,
  },
  {
    title: "The Agent Plans",
    body: "Claude on Amazon Bedrock turns your request into browser steps.",
    visualLabel:
      "Illustration: a small network of nodes where a light travels the chosen route, followed by the steps Identify fields, then Prepare actions.",
    Visual: PlanVisual,
  },
  {
    title: "The Browser Acts",
    body: "The extension clicks, types, and scrolls until the task is done.",
    visualLabel:
      "Illustration of a miniature browser: a cursor selects a name field, sample text is typed, the Continue button is pressed and a Done checkmark appears.",
    Visual: BrowserVisual,
  },
];

export function SolutionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef);

  return (
    <section
      ref={sectionRef}
      id="solution"
      data-inview={inView}
      className={`${styles.section} bg-white px-5 py-[72px] tab:px-10 tab:py-[100px]`}
    >
      <SectionHeader
        index="002"
        label="The Solution"
        title="Your Voice Is Enough."
        subtitle="Describe what you need. Let the agent handle the interactions."
      />

      <div className="mx-auto mt-12 grid max-w-[1040px] grid-cols-1 gap-2 tab:mt-[80px] tab:grid-cols-3">
        {STEPS.map(({ Visual, ...step }, i) => (
          <Reveal key={step.title} delay={i * 100}>
            <StepCard index={i + 1} {...step}>
              <Visual />
            </StepCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

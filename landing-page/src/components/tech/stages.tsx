// Architecture as implemented on the team's latest branch (origin/aayush):
// - backend/transcribe.py: sounddevice mic capture + SpeechRecognition's recognize_google
//   (Google's free speech recognition endpoint, not Google Cloud Speech-to-Text)
// - backend/agent.py: tier 1 direct commands, tier 2 Claude Haiku 4.5, tier 3 Claude Sonnet 4.5
//   via Strands BedrockModel on Amazon Bedrock
// - backend/server.py: WebSocket on localhost:8765, extension origin only
// - extension/manifest.json: Manifest V3, side panel, content script, Alt+Shift+V

export type Stage = {
  id: string;
  title: string;
  body: string;
  chips: string[];
  runsIn: "Chrome extension" | "Python backend";
  icon: React.ReactNode;
  /** Shown on stages that some commands skip */
  skipNote?: string;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const STAGES: Stage[] = [
  {
    id: "input",
    title: "Your Command",
    body: "Speak it with Alt+Shift+V, or type it in the side panel.",
    chips: [],
    runsIn: "Chrome extension",
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
        <rect x="9" y="2.5" width="6" height="11" rx="3" {...stroke} />
        <path d="M5 10.5a7 7 0 0 0 14 0M12 17.5v4" {...stroke} />
      </svg>
    ),
  },
  {
    id: "speech",
    title: "Speech Recognition",
    body: "The backend records the mic and Google speech recognition turns it into text.",
    chips: ["Google Speech Recognition", "SpeechRecognition (Python)"],
    runsIn: "Python backend",
    skipNote: "Typed commands skip this step",
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
        <path
          d="M3 12h1.5M6.5 8v8M10 5v14M13.5 9v6M17 7v10M20.5 11v2"
          {...stroke}
        />
      </svg>
    ),
  },
  {
    id: "routing",
    title: "Command Routing",
    body: "Picks the fastest route for each command.",
    chips: [],
    runsIn: "Python backend",
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
        <circle cx="5" cy="12" r="2" {...stroke} />
        <path d="M7 12h4m0 0 4-5h3m-7 5h7m-7 0 4 5h3" {...stroke} />
        <path d="m17 5 2 2-2 2M17 10l2 2-2 2M17 15l2 2-2 2" {...stroke} />
      </svg>
    ),
  },
  {
    id: "agent",
    title: "AI Agent",
    body: "Plans the steps and calls browser tools: read the page, click, type, fill a form, ask you.",
    chips: [
      "Strands Agents SDK",
      "Amazon Bedrock",
      "Claude Haiku 4.5 · Sonnet 4.5",
    ],
    runsIn: "Python backend",
    skipNote: "Direct commands skip this step",
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
        <path
          d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.3l-1.8-5.6L4.5 10.8 10.2 9Z"
          {...stroke}
        />
        <path d="M18.5 16.5v4M16.5 18.5h4" {...stroke} />
      </svg>
    ),
  },
  {
    id: "browser",
    title: "Browser Actions",
    body: "The content script numbers every element, then clicks, types, scrolls, and navigates.",
    chips: ["Chrome Extension · Manifest V3", "Content Script"],
    runsIn: "Chrome extension",
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
        <path d="M10 10l10 3.8-4.4 1.6-1.6 4.6Z" {...stroke} />
        <path
          d="M6.8 3v2.6M3 6.8h2.6M4.1 4.1l1.8 1.8M11 4.4 9.4 6M4.4 11 6 9.4"
          {...stroke}
        />
      </svg>
    ),
  },
];

export const ROUTES = [
  {
    name: "Direct",
    detail: "Instant, no model call",
    example: "“scroll down”, “click 12”",
  },
  {
    name: "Claude Haiku 4.5",
    detail: "Quick, one-step tasks",
    example: "“click the search button”",
  },
  {
    name: "Claude Sonnet 4.5",
    detail: "Multi-step tasks",
    example: "“fill out this form”",
  },
];

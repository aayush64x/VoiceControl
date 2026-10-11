# Voice Browser Agent: landing page design

The landing page for the Voice Browser Agent Chrome extension. It started as a recreation of the Framer
reference (https://tidy-raccoon-916026.framer.app/) and has since been refined section by section.
This file describes the design as built, so it can be kept consistent when the page changes.

## Page structure

| # | Section | Component | Notes |
|---|---------|-----------|-------|
| – | Hero | `HeroSection.tsx` | Interactive 3D assistant (Spline), headline, two CTAs, team-member ticker |
| 001 | The Problem | `ProblemSection.tsx` | Scroll-lit statement, sliding text behind a looping video, stats |
| 002 | The Solution | `SolutionSection.tsx` + `solution/*` | Three step cards with animated visuals (voice, plan, browser) |
| 003 | Process | `HowItWorksSection.tsx` | Four steps on a vertical timeline that light up on scroll |
| 004 | User Interface | `UserInterfaceSection.tsx` | Screenshot carousel, "Get Extension" CTA |
| 005 | Tech Stack | `TechnologySection.tsx` + `tech/*` | Vertical architecture flow: Input → Speech → Routing → AI Agent → Browser |
| – | Pricing / Team | `ReservedSections.tsx` | Empty spacer bands kept from the Framer file |
| – | Footer | `Footer.tsx` | Feedback form card over a looping video, social links |

The badge numbers (001–005) appear in `SectionBadge`. Change them there when sections are added or removed.

## Colour

All colours are CSS variables in `src/app/globals.css` and are exposed as Tailwind colours
(`text-ink`, `bg-sky`, `bg-lavender`, ...). Use the tokens rather than raw hex values.

| Token | Hex | Use |
|-------|-----|-----|
| `ink` / `heading` | `#3E536F` Deep Steel Blue | Headings, hero title, dark buttons |
| `muted` | `#69758F` Muted Slate | Body copy, subtitles, ticker names (60%) |
| `ice` | `#D4F1FF` Ice Blue | Badges, light UI fills |
| `sky` | `#A9DFFF` Sky Glow | Timeline line, footer top |
| `surface` | `#EAF7FF` | Soft light fills (inactive icon tiles) |
| `periwinkle` / `grey` | `#AEC4FF` | Secondary accents, stat labels |
| `lavender` | `#C8B8FA` | Primary accent: badge dot, waveform, connectors, carets |
| `lilac` | `#E7E5FF` | Gradient accent |
| `ink-soft` | `#2C3B52` | Intentionally dark display panels (Solution visuals, speech panel) |
| `--rainbow` | periwinkle → lavender → lilac → sky | Rim of the primary button, active timeline marker |

**Backgrounds.** The page and the hero are white. The 3D canvas backdrop is pinned to the hero colour
(`SPLINE_BACKDROP` in `src/lib/spline.ts`). It must stay opaque, because the glass material refracts it
and a transparent backdrop renders the glass black.

**Cards.** Every card below the hero uses the frosted steel-blue `.card-raised` surface: a gradient from
`#8FA4BD` to `#7A8DA7` with a white inner glow (`inset 0 0 4px rgba(255,255,255,.8), inset 0 0 40px #fff`).
It matches the footer feedback card. Text on these cards is white for titles and values, and
white at 75% for body copy. White chips and inner boxes on a card keep `ink`/`muted` text.

## Typography

- Font: Geist (via `next/font`), weights 400/500/600/700. Body letter-spacing is `-0.03em`.
- Hero title: 48 / 64 / 80px (phone / tablet / desktop), semibold, `-0.06em`, leading 1.
- Section titles: 40 / 48 / 72px, medium, `-0.05em`, leading 1.1.
- Subtitles: 18px, `muted`. Card titles: 18–20px medium. Body: 14–16px, leading 1.35–1.4.

## Layout

- Breakpoints: `tab` at 810px and `desk` at 1200px (Tailwind custom screens).
- Content width is around 1040–1280px. Side gutters are 20 / 40 / 80px.
- Large rounded shapes are part of the look: 120px card corners and fully rounded pills.

## Motion and interaction

- Animations only run while their section is on screen (`useInView` sets `data-inview`; CSS pauses the
  rest with `animation-play-state`). Each section fades up once on first view (`Reveal`).
- `prefers-reduced-motion` shows calm final frames and turns off marquees and smooth scrolling.
- Hero: the Spline scene follows the cursor. Rendering pauses when the hero is off screen.
  If the self-hosted runtime fails, it falls back to the Spline iframe.
- Hero ticker: team names scroll left in a 30s loop. Hovering or focusing a name pauses it in place.
  Each name opens the person's LinkedIn profile in a new tab. Edit the `teamMembers` array in
  `HeroSection.tsx` to change who is listed.
- Problem: words light up as you scroll. Text slides behind the video.
- Solution: each card plays its visual once on view. Hovering a card replays it.
- Process: steps fill in and the timeline grows with scroll progress.
- Tech Stack: stages light up as they pass the middle of the viewport. Connectors fill and carry a
  travelling pulse. The speech panel loops through waveform → transcript.

## Assets

- `public/media/`: images, icons (SVGs used as CSS masks so they take palette colours) and videos.
  The Problem video ships as both MP4 and WebM.
- `public/spline/`: the self-hosted Spline scene (`assistant.splinecode`) and runtime WASM.
  The page does not need `cdn.spline.design`.

## Placeholders still to fill

- `src/lib/links.ts`: the Chrome Web Store link (currently `#contact`).
- User Interface slides: screenshot images and copy are marked `[Screenshot placeholder]`.
- Footer: "Created by [Team name]" and the social links.
- Pricing and Team sections are empty spacer bands.

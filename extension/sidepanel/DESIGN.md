# Soft Glass Companion: side panel design

The side panel is one compact card. A glass mascot shows what the agent is doing, a short status line says it in words, and a dock below shows only the controls for the current step.

## Files

| File | What it holds |
| --- | --- |
| `sidepanel.html` | Markup for the card, mascot layers, dock panels, steps list |
| `styles/tokens.css` | Every color, type size, radius, shadow and timing |
| `styles/mascot.css` | Mascot layers, per-state motion, reduced-motion fallback |
| `styles/panel.css` | Card layout, buttons, summary, steps, typed box |
| `js/mascot.js` | Voice level (`--lvl`) and liquid-edge strength. Mic, external feed or synthetic signal. |
| `js/panel.js` | State machine and the public `AgentPanel` API |
| `js/demo.js` | Scripted demo flow with made-up details. Turns itself off once the bridge is connected. |
| `states.html` | All eight states side by side, for review |

Plain HTML, CSS and JS. No build step, no framework, no external requests.

## Try it

- Open `states.html` in Chrome to see every state at once.
- Open `sidepanel.html` and press **Space** (or the mic) to run the full flow. The `···` menu runs the flow with a clarifying question, jumps to any state, and toggles steps, spoken replies and reduced motion.
- `sidepanel.html?state=confirm` opens straight into a state. `?reduce=1` forces reduced motion.
- As an extension: `chrome://extensions` → Developer mode → Load unpacked → pick `extension/`. Click the toolbar icon to open the side panel.

## States

One component. Each state sets the mascot (`data-state`), the status copy, and which dock panel shows.

| State | Mascot | Status copy | Dock |
| --- | --- | --- | --- |
| `idle` | Slow breathing, faint halo | **How can I help?** Tap the mic or press Space… | Large mic, "Type instead" |
| `listening` | Rings expand, light waves cross the body, scales and glows with voice level | **Listening…** | Live transcript, stop button |
| `thinking` | Inner light wanders, reflections speed up, eyes look up | **Understanding your request…** Finding the right steps. | Progress pill, Stop |
| `working` | Sheen sweeps across, eyes scan left to right, quicker bob | **Working on your request…** + live step ("Filling out 6 fields…") | Progress pill, Stop |
| `confirm` | Settles and shrinks a little, steady ring | **Ready to submit?** Please check these details first. | Summary of what will be sent, Cancel / Submit, "say yes or cancel" |
| `done` | One soft glow pulse, check badge draws in, eyes squint happily | **Task completed.** + backend's result text | "Start a new request" |
| `ask` | Small head tilt, `?` badge | The agent's question | Numbered answer options, mic, "Type instead" |
| `error` | Desaturated, tilted, `!` badge, very slow | **I couldn't finish that.** + plain reason | Type instead / Try again |

Rules the states follow:

- `done` only appears when the backend sends `done`. The panel never assumes success.
- `confirm` never times out and never submits by itself.
- Every state names itself in text (the small eyebrow label plus the title). Mascot motion and color are extra, never the only signal.

## Hooking it up to the bridge

`panel.js` exposes `window.AgentPanel`. It never touches the network.

```js
// Backend -> panel: pass plan.md messages straight through.
socket.onmessage = (e) => AgentPanel.handleMessage(JSON.parse(e.data));
AgentPanel.setConnection('online');   // 'online' | 'offline' | 'demo'; anything but 'demo' disables demo.js

// Panel -> backend: user intents.
AgentPanel.on('text',    (text)   => send({ type: 'user_said', text }));
AgentPanel.on('answer',  (answer) => send({ type: 'answer', text: answer }));
AgentPanel.on('confirm', ()       => send({ type: 'answer', text: 'yes' }));
AgentPanel.on('cancel',  ()       => send({ type: 'answer', text: 'no' }));
AgentPanel.on('stop',    ()       => send({ type: 'user_said', text: 'stop' }));
AgentPanel.on('mic',     ()       => startSpeechRecognition());   // Slice 7
AgentPanel.on('stopListening', () => recognition.stop());
```

Messages `handleMessage` understands:

| `type` | Fields | Result |
| --- | --- | --- |
| `listening` | | Listening state |
| `transcript` | `text` | Updates the live transcript |
| `thinking` | | Thinking state |
| `step` | `tool`, `input`, `status` (`running` / `done` / `error`), optional `id` | Adds or updates a row in Steps; while running, sets a plain-language progress line from the tool name |
| `ask` | `question`, `yes_no`, `summary: [{label, value}]`, `options: []`, `hint` | `yes_no: true` → confirm state with the summary. Otherwise → ask state with options. |
| `say` | `text` | Speaks it (if enabled). While working, also shows it as the progress line. |
| `done` | `text` | Done state |
| `error` | `title`, `text` | Error state |

`done`, `error`, `thinking`, `listening` and `transcript` are additions to the plan.md message list. `ask.summary` and `ask.options` are optional extras on the existing `ask`.

Direct calls if you need them: `setState(name, data)`, `setProgress(text)`, `setTranscript(text)`, `addStep({tool, label, status})` → id, `updateStep(id, {status, label})`, `clearSteps()`, `speak(text)`, `mascot.setLevel(0..1)`.

Tool names map to plain progress text in `TOOL_COPY` in `panel.js` (`fill_form` → "Filling out 6 fields…"). Raw tool names only show in the Steps list, which is where the Strands tool calls stay visible for judges.

## Mascot renderers

The mascot can be drawn three ways, picked in **Settings → Mascot**. The halo, rings, badges, status text and state machine are the same in all three.

| Option | What it is | Follows voice and states | Cost |
| --- | --- | --- | --- |
| **3D orb** (default) | `js/mascot-gl.js`: a local Three.js recreation of the Spline orb, with a pastel glass core, soft reflections and a wobbling iridescent film. Hover bends the film; click sends a ripple. | Yes. Voice level makes the film ripple, the light flow faster and the orb glow. Each state has its own speed, wobble and saturation. | `vendor/three.module.min.js` (690 KB, loaded only when this option is on). ~0.5 s to first frame, under 10 MB JS heap. The loop pauses when hidden, when off, and with reduced motion. |
| **Spline** | The original scene from my.spline.design in an iframe | No. It's a cross-origin page, so the panel can't send it voice level or state. Only its own hover and click work. | Needs network every time. Chrome reported 447 MB for the Spline tab in the screen recording. Falls back to the 3D orb if it doesn't load within 10 s. |
| **Simple** | The earlier CSS glass blob, with eyes | Yes (CSS) | Lightest. Used automatically if WebGL is unavailable. |

The Settings section shows a live readout (renderer, time to ready, FPS, JS heap). An iframe's memory isn't counted in that heap, so use Chrome's Task Manager (Shift+Esc) to compare the Spline option.

Spline in MV3: extension pages don't restrict `frame-src`, so the iframe is allowed by the extension. Whether Spline allows being framed by a `chrome-extension://` page depends on its response headers, which couldn't be checked from the build environment. If the Spline option stays blank, that's the reason.

## Motion

The mascot is plain DOM: a clipped blob with eight stacked layers, plus eyes, badge, halo, rings and a floor shadow (see the header comment in `mascot.css`).

- **Liquid body.** `border-radius` morphs between four blob shapes. An SVG turbulence filter displaces the edge a few pixels so it wobbles like jelly. JS raises the displacement with voice level.
- **Light through glass.** A blurred conic gradient rotates inside the body (blend mode `screen`), and an iridescent band rotates the other way around the edge. Their speed is the main "how busy is it" signal: 22s per turn idle, 4 to 7s while listening or working.
- **Voice reaction.** `mascot.js` writes `--lvl` (0 to 1) every frame from the mic RMS, using a fast attack and slow release. The body scales up to 7%, the halo brightens and grows, and the edge wobble deepens. If the mic isn't available it falls back to a synthetic syllable rhythm so the demo still looks alive.
- **Eyes** carry the personality: a blink every ~5s, look up while thinking, scan while working, squint after success. Eyes sit outside the filter so they stay crisp.
- **Easing.** `--ease-glass` for floating, `--ease-soft` for UI, `--ease-pop` only for the badge. No bouncing, no spinning of the character itself.
- **UI transitions.** Status text fades out and back in over 140ms. Dock panels rise 6px as they appear.

**Reduced motion.** `prefers-reduced-motion` or the menu toggle stops every animation and the edge filter. States stay distinct through halo strength, the steady ring, eye shape, badges and text. With all motion off the panel is fully usable.

**Cost.** One rAF loop that writes only when a value changes, CSS animations on transforms and opacity, and one small SVG filter. If the filter is too slow on the demo laptop, delete `filter: url(#m-liquid)` from `.mascot__body`. Nothing else depends on it.

## Accessibility

- Every target is at least 48px. The mic is 72px. Submit and Cancel are 52px tall.
- **Space** starts and stops listening, **Esc** stops work or cancels a confirmation, and **1–9** pick an answer option. All controls are real buttons with visible focus rings.
- The status block is a polite live region, so screen readers hear each state change. On confirm, ask and error, focus moves to the title.
- Text contrast is at least 4.5:1. Body text is 15px and buttons are 16px.
- Spoken replies are opt-in from the menu so they don't talk over a screen reader.
- The typed box is always one tap away, as the plan's backup for a noisy hall.

## Tokens

All in `styles/tokens.css`. Main ones:

| Token | Value | Use |
| --- | --- | --- |
| `--c-sky` | `#7DCBFF` | Mascot body, brand |
| `--c-lavender` | `#A7B8FF` | Mascot reflections |
| `--c-ice` | `#BFE9FF` | Halo and glow |
| `--c-mist` | `#F5F9FC` | Page background |
| `--c-navy` | `#1E2A3A` | Text |
| `--c-text-2` | `#56677C` | Supporting text |
| `--c-action` | `#1F6FC5` | Mic, Submit, links (white text passes 5:1) |
| `--c-success` | `#23977D` | Check badge only |
| `--r-lg` / `--r-md` / `--r-pill` | 24 / 16 / 999px | Card / inner surfaces / buttons |
| `--target` / `--target-lg` | 48 / 72px | Minimum hit target / mic |

Sky blue is too light to carry white text, so buttons use a deeper blue (`--c-action`). The brand colors stay on the mascot and glows.

# Split tasks: night of Oct 10

Freeze at **4:00 AM**. Submit by **8:00 AM**.

## Getting the latest code (Rylan, do this first)

```
git checkout rylan
git pull origin aayush        # should merge cleanly — your branch is already merged into aayush
```

Your bridge fix in `server.py` was replaced by a command queue that does the same thing and more. Keep the `aayush` version.

## Who touches what

| Aayush only | Rylan only |
|---|---|
| `backend/agent.py`, `backend/server.py`, `backend/transcribe.py` | `docs/` (everything) |
| `extension/content.js`, `sidepanel.js`, `sidepanel.html` | `test-form/` (new) |
| `extension/background.js`, `manifest.json` | `extension/readable.js` (new) + `tests/readable.test.js` (new) |
| | `README.md`, `run.sh`, `.env.example` |

**If you find a bug in an Aayush file, don't fix it. Write it in `docs/test-log.md` and message Aayush.** This is how we avoid merge conflicts tonight.

---

## Aayush

1. **Run the SSA questionnaire end to end, live, by voice.** Fix only what breaks.
2. **Show the step list in the side panel.** Each Strands tool call shows by name with ✓ or ✗, which makes Strands visible to judges.
3. **Add a keyboard shortcut for the mic, and spoken replies.** This makes the "no mouse needed" claim true.
4. **Only accept connections from the extension.** The backend currently accepts any website.
5. **Wire in `readable.js`** from Rylan as the `read_aloud` tool (about 15 minutes, once it's ready).

---

## Rylan, in this order

### 1. Test the main demo and log what breaks (about 1 hour, most important)
- Start the backend with `python backend/agent.py`, reload the extension, and open the side panel.
- Run the SSA questionnaire with one sentence, for example: *"Check what disability benefits I might qualify for"*.
- Run it 3 times. After each run, write these in `docs/test-log.md`:
  - The exact command
  - What happened at each question
  - Where it got stuck
  - The terminal output (the `[bridge]` and `[command]` lines)
- Also try each of these once: `scroll down`, `back`, `open weather.gov`, `click 5`, typing into a field, a dropdown, and a yes/no question.
- **Message Aayush after every run that fails.** Don't wait to finish the whole list.

### 2. Local backup form, `test-form/index.html` (about 30 minutes)
This is the wifi-is-down backup for the demo.
- Make a copy of the SSA questions from your walkthrough on one plain HTML page.
- Include every input type: text, radio, dropdown, checkbox, date, and a submit button.
- Use no frameworks and no external files, so it works from `file://`.
- On submit, show a "Results" section on the same page that lists the answers. It must not send anything anywhere.

### 3. Article text extractor, `extension/readable.js` (about 1 hour)
This is the standalone function behind "read this article to me." Aayush will wire it in, so **don't edit `content.js` or `manifest.json`**.

```js
// Returns { title, text } — the main readable text of the page.
function extractMainText(doc) { ... }

if (typeof module !== "undefined" && module.exports) {
  module.exports = { extractMainText };
}
```

Rules:
- Use `<article>`, then `<main>`, then `[role="main"]`, if any of them exist.
- Otherwise, use the element whose direct `<p>` children have the most text.
- Remove these: `nav, header, footer, aside, script, style, noscript, form, button, figure figcaption, [aria-hidden="true"]`. Also remove anything whose class or id contains `ad`, `promo`, `cookie` or `newsletter`. Match whole words only, so `header` and `shadow` don't count.
- Join the paragraphs with blank lines, collapse extra whitespace, and cap the text at 5000 characters. Cut at the end of a sentence.
- `title` comes from the first `<h1>`, or from `document.title` if there's no `<h1>`.
- Don't use any imports. Plain functions only, the same style as `content.js`.

Tests go in `tests/readable.test.js`. Copy the jsdom header from `tests/content.test.js` and cover these cases: an article page, a page with no article tag, a page with nav and ads to strip, an empty page, and the 5000-character cap. Run them with `npx jest`.

### 4. Project website, `docs/index.html` (about 1.5 hours)
Follow `docs/BRIEF.md`. Updates to the brief:
- Voice works now. Remove "coming soon."
- The main demo is the **SSA eligibility questionnaire**, not usa.gov.
- Leave the screenshot placeholders. We'll add real screenshots at 4 AM.

### 5. README and `run.sh` (about 30 minutes)
- Add setup steps for both Mac and Windows. The current README only covers Windows PowerShell.
- `run.sh` should activate the venv, check that `backend/.env` exists, and start `python backend/agent.py`.
- Include the steps for loading the extension, and the microphone permission note: on Mac, the terminal app needs mic access in System Settings → Privacy & Security → Microphone.
- `.env.example`: note that `agent.py` currently hardcodes its model IDs, so `BEDROCK_MODEL_ID` isn't used yet.

### 6. At 4 AM, together
- Rehearse the demo 3 times.
- Record the backup video.
- Take screenshots for the website.
- Write the submission text.

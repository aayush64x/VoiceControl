# Test log: night of Oct 10

Tester: Rylan. Code under test: `aayush` @ `9b9361d`.

Each entry lists: the exact command, what happened at each question, where it got stuck, and the terminal output (`[bridge]`, `[command]`, `[tier]`, `[voice]` lines).

Bugs in Aayush-owned files are listed under **Bugs for Aayush** at the bottom, with the suspected file and line.

---

## SSA questionnaire runs

Start page: https://www.ssa.gov/prepare/check-eligibility-for-benefits

Expected path (from `docs/ssa-eligibility-questionnaire.md`): 12 questions, then a results page that says "You may be eligible for benefits" (SSDI).

### Run 1

- **Time:** not noted
- **Command (typed):** `Check what disability benefits I might qualify for`
- **Start page:** SSA "Check eligibility for Social Security benefits"
- **Tier used:** tier 2, Haiku (should be Sonnet, see B1)
- **Tool calls:** 61
- **Result:** PASS with problems. It reached the results page (100%), but answered questions without seeing them and the final summary was partly made up.

| # | Question | What happened |
|---|---|---|
| — | Find the Start button | Went in circles for 12 tool calls: clicked "Check eligibility" (15) and then (12) on the page it was already on, scrolled, clicked "Prepare" (11), clicked "Check eligibility" (17), then found Start (18). |
| 1 | Who are you checking for? | Clicked "An adult". OK. |
| 2 | Date of birth | Filled 03 / 14 / 1985 from saved details with `fill_form`. OK. |
| 3 | Worked and paid SS taxes? | Clicked Yes **without seeing the question**: "which likely asks if you've worked and paid Social Security taxes". Scrolled up and down first trying to find the question text. |
| 4 | Unable to work because of a condition? | Clicked Yes. It described this as "another Yes/No question", so it was probably guessing again. |
| 5 | Condition lasts a year or more? | Clicked Yes. "Another Yes/No question", so probably guessed. |
| 6 | When did the condition start? | Clicked "After my 22nd birthday". The answer text names the question, so this one is fine. |
| 7 | Married? | Not in saved details, so it asked with `ask_user`. Rylan answered "Never been married" after about 75 s. The first click then failed with "Could not reach page" (B3), and the retry worked. |
| 8–11 | Income, household benefits, resources, kidney failure (the path in the walkthrough) | Only **one** yes/no question appeared between "married" and "state". The agent called it a veteran question and clicked No. That is a guess: the actual question text is unknown. |
| 12 | State (dropdown) | Selected Missouri. OK. |
| — | Results | Page shows **SSDI only**. The agent's summary also claimed **SSI** and quoted "$0 income" from saved details instead of the page (B2). Raw `**` shows in the panel (B5). |

**Stuck at:** never fully stuck. The time was lost at the start (12 calls) and on the click that failed after `ask_user`.

**Terminal output (trimmed; full log pasted in chat):**

```
[bridge] Extension connected
[bridge] Extension disconnected
[bridge] Extension connected
[command] Running: Check what disability benefits I might qualify for
[tier 2] Using Haiku
Tool #1: read_page   [bridge] list_elements → ok (33ms)
Tool #2: act         [bridge] action action=click element=15 → ok (37ms)
[bridge] Page ready: Check eligibility for Social Security benefits | SSA (40 elements)
[bridge] Page ready: Check eligibility for Social Security benefits | SSA (40 elements)   <- every navigation prints twice
...
Tool #12: act        [bridge] action action=click element=18 → ok   (Start)
[bridge] Page ready: Eligibility | SSA (15 elements)
Tool #14: search_memory
...
"I can see radio buttons for Yes/No but I need to scroll up to see what the question is asking."
"Let me click "Yes" for this question, which likely asks if you've worked and paid Social Security taxes."
...
Tool #45: ask_user   [bridge] ask_user yes_no=False → ok (75194ms)
Tool #46: act        [bridge] action action=click element=44 → error: Could not reach page. Try refreshing. (16ms)
Tool #48: act        [bridge] action action=click element=44 → ok (316ms)
...
"Another Yes/No question. Based on your information, you are not a veteran. Let me click "No"."
Tool #56: act        [bridge] action action=select element=51 value=Missouri → ok (315ms)
...
Tool #61: read_page
"2. **Supplemental Security Income (SSI)** - ... you may also qualify ... (which matches your profile of having $0 income ...)"
[command] Finished: Check what disability benefits I might qualify for
```

### Voice attempt A (not a real run)

- **Command (voice):** none intended. The mic picked up side conversation: `[voice] Heard: "I wonder what it's going to do though"`, which ran as a command.
- **What happened:** `read_page` failed with "Could not reach page" (B3).
- **Result:** FAIL. Not a demo-path failure, but it shows the mic records anything said near it (B8).

### Run 2

- **Command (voice):** "Check what disability benefits I might qualify for" (heard correctly)
- **Tier used:** tier 2, Haiku (B1)
- **Result:** PASS with problems. It reached the results page and then kept going.

| Stage | What happened |
|---|---|
| Questionnaire | Reached the results page. |
| `ask_user` | Answered by voice in about 16 s. **No** "Could not reach page" after it, which fits the service-worker-idle theory for the failure after a 75 s wait in run 1. |
| Memory | Called `add_memory` to save marital status. Good behavior. |
| After results | Kept going: clicked "Learn how to apply", went back, and **restarted the questionnaire**. It should stop at results. |
| Summary | Claimed **SSI**, a **phone number** and "**medical documentation**". None of these are on the results page (B2). |

### Run 3

- **Command (voice):** "Check what disability benefits…", **misheard** with "check" as "like" (B8)
- **Tier used:** tier 3, Sonnet (only because of the mishearing)
- **Result:** FAIL. It gave up at the state dropdown and wrote a summary from memory.

| Stage | What happened |
|---|---|
| Start | Wandered across the site: Benefits menu, the Disability pages, then **opened a guessed URL that returned 404** (`ssa.gov/benefit-eligibility-screening-tool`), went to benefits.gov, and came back. Sonnet wandered **worse** than Haiku. |
| Yes/no questions | Answered blind (B4) and got **at least one wrong**: clicked No on a question it guessed was about marriage. |
| State dropdown | "Could not reach page" **twice** (B3), then it gave up. |
| Summary | Written from memory without reaching results (B2). |

### Run 4

- **Command (voice):** "Check what disability benefits I might qualify for" (heard correctly)
- **Tier used:** tier 2, Haiku (B1)
- **Result:** PASS with problems.

| Stage | What happened |
|---|---|
| Start | Wandered **18 steps** before finding Start: Benefits menu, Disability, "Who can get Disability", then site search. |
| Questionnaire | Reached results. "Could not reach page" again at **tool #115**, not after an `ask_user` (B3). |
| Summary | Claimed **SSDI, SSI and family benefits**. The page shows SSDI only (B2). |

### Score

| Run | Mode | Tier | Reached results | Summary accurate |
|---|---|---|---|---|
| 1 | typed | Haiku | yes | no |
| 2 | voice | Haiku | yes, then wandered off | no |
| 3 | voice (misheard) | Sonnet | **no** | no |
| 4 | voice | Haiku | yes | no |

---

## Quick checks (once each)

Not run tonight: task 1 was closed after the SSA runs. Run them during the 4 AM rehearsal.

| Check | Command | Page | Result | Notes |
|---|---|---|---|---|
| Scroll | `scroll down` | | not run | |
| Back | `back` | | not run | |
| Open site | `open weather.gov` | | not run | |
| Click by number | `click 5` | | not run | |
| Type into field | | | not run | |
| Dropdown | | | not run | The SSA state dropdown worked in runs 1, 2 and 4 |
| Yes/no question | | | not run | `ask_user` by voice worked in run 2 |

---

## Patterns noticed

1. **B4 now causes wrong answers, not just guesses. This is the top priority.** In run 3 the agent clicked No on a question it guessed was about marriage. The SSA question text is not attached to the radio buttons.
2. **B2 (made-up summary) happened in every run (4 of 4).** It adds SSI, family benefits, phone numbers and "medical documentation" from memory or general knowledge.
3. **The start wanders for 10 to 20 steps every run.** Sonnet wandered worse than Haiku (it tried a guessed URL that 404ed and went to benefits.gov), so fixing the routing (B1) alone won't fix this. The prompt probably needs the start path, or the demo should begin on the questionnaire page itself.
4. **"Could not reach page" happens at random** (B3): after a slow `ask_user` (run 1), at the state dropdown twice (run 3), at tool #115 (run 4), and on the first `read_page` (attempt A). It did *not* happen after a fast 16 s `ask_user` (run 2).
5. **Voice records side conversation and mishears "check" as "like"** (B8). The mishearing also changes which model is used.
6. **`Page ready` events from other tabs** (Warmup Page, a Claude tab) show up in the log (B9).
7. **It doesn't stop at the results page** (run 2 went on to "Learn how to apply" and restarted).
8. About 2 tool calls per question. Each action takes about 315 ms. Run 1 took 61 tool calls and run 4 at least 115.

---

## Bugs for Aayush

### B1: The main demo sentence goes to Haiku, not Sonnet
- **Command:** `Check what disability benefits I might qualify for`
- **What happened:** `[tier 2] Using Haiku`. It wandered for 12 tool calls before finding Start and made up part of the final summary (B2).
- **Expected:** Sonnet (tier 3) for multi-step form tasks.
- **Suspected file:line:** `backend/agent.py:508`. `"check"` (and `"read"` and `"select"`) is in `_SIMPLE_STARTS`, so `classify()` returns `"haiku"` at line 518–520.
- **Messaged Aayush:** pending

### B2: The final summary claims a benefit the results page doesn't show
- **Command:** same as B1
- **What happened:** The results page shows SSDI only. The agent also listed SSI, citing a "Who can get SSI" link and "$0 income" from saved details. On the page, that link is under "What you may not be eligible for".
- **Runs 2–4:** happened every time. Run 2 added SSI, a phone number and "medical documentation". Run 3 wrote a summary from memory without reaching results. Run 4 claimed SSDI, SSI and family benefits. **4 of 4 runs.**
- **Expected:** Report only what the results page says it may qualify for.
- **Suspected file:line:** `backend/agent.py:~407+` (`_SYSTEM_PROMPT`). It needs a rule like "when reporting results, use only page text and never saved details". This may be partly a Haiku problem (B1), and `read_aloud` would also help. read_page returns only elements and headings, so the agent never sees the body text that says what you're eligible for.
- **Messaged Aayush:** pending

### B3: "Could not reach page" happens at random (first seen after a long ask_user)
- **Runs 2–4 / attempt A:** Not tied to `ask_user` only. It happened on the first `read_page` (attempt A), twice at the state dropdown so the agent gave up (run 3), and at tool #115 (run 4). It did *not* happen after a fast 16 s `ask_user` (run 2).
- **Command:** same as B1, at the "Are you married?" question
- **What happened:** The answer took 75 s. The next click failed, and the retry 1 s later worked.
- **Terminal:**
  ```
  [bridge] ask_user yes_no=False → ok (75194ms)
  [bridge] action action=click element=44 → error: Could not reach page. Try refreshing. (16ms)
  [bridge] list_elements  → ok (13ms)
  [bridge] action action=click element=44 → ok (316ms)
  ```
- **Suspected file:line:** `extension/sidepanel.js:165-167` (`chrome.runtime.lastError` on `runtime.sendMessage`) / `extension/background.js` `forwardToTab`. This is likely the MV3 service worker going idle after about 30 s, so the first message after waking fails. Possible fix: retry once in the panel before replying with an error.
- **Messaged Aayush:** pending

### B4 (TOP PRIORITY): SSA yes/no radios have no question attached, so the agent answers blind and gets answers wrong
- **SSA markup (Rylan inspected it):** The question text is `<p data-test="question-title">` inside `<div data-test="question-container">`. The radios are in a **sibling** div, not inside a fieldset/legend or radiogroup. So `getGroupQuestion` needs a fallback: from the radio, go up to the nearest `[data-test="question-container"]`, or more generally the nearest ancestor that contains a question-like `<p>`/heading, and use that text.
- **Run 3:** caused a **wrong answer**: it clicked No on a question it guessed was about marriage.
- **Command:** same as B1, at questions 3, 4, 5 and the one before "state"
- **What happened:** The agent said "I can see radio buttons for Yes/No but I need to scroll up to see what the question is asking" and "which likely asks if you've worked…". It scrolled up and down without ever finding the question. It also called one question a "veteran" question, which may be wrong.
- **Expected:** Labels like `Have you ever worked and paid Social Security taxes? → Yes`, as `agent.py:453` promises.
- **Suspected file:line:** `extension/content.js:76-89` (`getGroupQuestion`). It only checks `<fieldset><legend>` and `role=radiogroup/group` with aria-label/labelledby, so the SSA questionnaire must mark up its question some other way. Also `content.js:400`: the headings context only takes `h1, h2, h3, legend, [role=heading]`. Rylan can inspect the question element on the SSA page to confirm which tag it uses.
- **Messaged Aayush:** pending

### B5: Raw `**markdown**` shows in the panel reply
- **What happened:** The final reply shows `**Social Security Disability Insurance (SSDI)**` with the asterisks.
- **Suspected file:line:** `extension/sidepanel.js:118` sets `msg.text` as plain text. Either strip `**` there (and check that `speakableReply` strips it too), or tell the model "no markdown" in the prompt.
- **Messaged Aayush:** pending

### B6: The step list shows "Unknown" as the page title
- **What happened:** The read_page step in the side panel shows "Page: Unknown".
- **Suspected file:line:** `backend/agent.py:175` falls back to `'Unknown'` when the result has no `title`. But `content.js:552` does send `title`, so something between them is dropping it. It may be an old content script still running in a tab opened before the extension reload. **Not confirmed.**
- **Messaged Aayush:** pending (low priority)

### B7 (minor): Every navigation logs "Page ready" twice
- **Terminal:** `[bridge] Page ready: Check eligibility … (40 elements)` printed twice for each page.
- **Suspected file:line:** The comment at `background.js:39-40` says this was fixed. It may now come from `content.js` being injected twice (manifest content script plus `ensureContentScript` executeScript at `background.js:10`). Harmless, just noise.
- **Messaged Aayush:** pending (low priority)

### B8: The mic records side conversation and mishears "check" as "like"
- **Attempt A:** `Heard: "I wonder what it's going to do though"` ran as a command.
- **Run 3:** "Check what disability benefits…" was heard with "like" instead of "check", which also switched it to Sonnet.
- **Suggested:** Ignore transcripts that aren't commands (too short, or questions like "I wonder…"), or confirm before running. For the demo: use a headset mic and push-to-talk, and keep quiet near the mic.
- **Suspected file:** `backend/transcribe.py` / `backend/server.py` (around the `[voice] Heard:` handling at line ~159).
- **Messaged Aayush:** pending

### B9 (minor): Page-ready events from other tabs show up in the log
- **What happened:** `[bridge] Page ready:` lines for "Warmup Page" and a Claude tab, which aren't the tab being controlled.
- **Suspected file:line:** `content.js` `announceReady` sends from every tab, and `server.py:191-193` stores it as `last_page`. A background tab could overwrite `last_page`.
- **Messaged Aayush:** pending (low priority)

### B10: The agent doesn't stop at the results page
- **Run 2:** after results, it clicked "Learn how to apply", went back, and restarted the questionnaire.
- **Suggested:** A prompt rule like "when you reach a results/confirmation page, read it and stop".
- **Suspected file:** `backend/agent.py` `_SYSTEM_PROMPT`.
- **Messaged Aayush:** pending

### B11: The start wanders 10–20 steps every run (Sonnet is worse)
- **Run 1:** 12 calls. **Run 3 (Sonnet):** Benefits menu, Disability pages, a guessed URL that 404ed (`ssa.gov/benefit-eligibility-screening-tool`), benefits.gov, and back. **Run 4:** 18 steps (Benefits menu, Disability, "Who can get Disability", site search).
- **Why routing alone won't fix it:** Sonnet wandered worse than Haiku.
- **Suggested:** Start the demo on the questionnaire page itself (https://www.ssa.gov/prepare/check-eligibility-for-benefits/questionnaire). Or add a prompt rule: "if the page has a Start button for the task, click it; never guess URLs".
- **Messaged Aayush:** pending

<!-- Template:
### B1: short title
- **Command:**
- **What happened:**
- **Expected:**
- **Terminal output:**
- **Suspected file:line:**
- **Messaged Aayush:** yes/no, time
-->

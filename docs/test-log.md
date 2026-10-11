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

### Run 2

- **Time:**
- **Command (voice or typed):**
- **Tier used:**
- **Result:** PASS / FAIL

| # | Question | What happened |
|---|---|---|
| 1 | Who are you checking for? (single-select) | |
| 2 | Date of birth (MM DD YYYY) | |
| 3 | Worked and paid SS taxes? | |
| 4 | Unable to work because of a condition? | |
| 5 | Condition lasts a year or more? | |
| 6 | When did the condition start? | |
| 7 | Married? | |
| 8 | Little or no income? | |
| 9 | Household gets government benefits? | |
| 10 | Value of resources | |
| 11 | Permanent kidney failure? | |
| 12 | State (dropdown) | |
| — | Results read aloud? | |

**Stuck at:**

**Terminal output:**

```
```

### Run 3

- **Time:**
- **Command (voice or typed):**
- **Tier used:**
- **Result:** PASS / FAIL

| # | Question | What happened |
|---|---|---|
| 1 | Who are you checking for? (single-select) | |
| 2 | Date of birth (MM DD YYYY) | |
| 3 | Worked and paid SS taxes? | |
| 4 | Unable to work because of a condition? | |
| 5 | Condition lasts a year or more? | |
| 6 | When did the condition start? | |
| 7 | Married? | |
| 8 | Little or no income? | |
| 9 | Household gets government benefits? | |
| 10 | Value of resources | |
| 11 | Permanent kidney failure? | |
| 12 | State (dropdown) | |
| — | Results read aloud? | |

**Stuck at:**

**Terminal output:**

```
```

---

## Quick checks (once each)

| Check | Command | Page | Result | Notes |
|---|---|---|---|---|
| Scroll | `scroll down` | | | |
| Back | `back` | | | |
| Open site | `open weather.gov` | | | |
| Click by number | `click 5` | | | |
| Type into field | | | | |
| Dropdown | | | | |
| Yes/no question | | | | |

---

## Patterns noticed

- **The agent can't see question text on SSA.** The radio buttons come through as plain "Yes"/"No" with no question attached, so every yes/no answer is a guess based on saved details. This is the biggest risk to the demo: it could answer a question wrong, and a judge reading the page would notice.
- **Haiku handles the main demo sentence.** Any command starting with "check" goes to Haiku. Haiku wandered at the start and made up part of the summary.
- **About 2 tool calls per question** (read_page, act, read_page, Next). 61 calls total, with each action taking about 315 ms.
- **The first action after a long `ask_user` wait fails**, then works on retry. This happens whenever the user takes over about 30 s to answer.
- **Every navigation logs `Page ready` twice.**

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
- **Expected:** Report only what the results page says it may qualify for.
- **Suspected file:line:** `backend/agent.py:~407+` (`_SYSTEM_PROMPT`). It needs a rule like "when reporting results, use only page text and never saved details". This may be partly a Haiku problem (B1), and `read_aloud` would also help. read_page returns only elements and headings, so the agent never sees the body text that says what you're eligible for.
- **Messaged Aayush:** pending

### B3: The first action after a long ask_user fails with "Could not reach page"
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

### B4: SSA yes/no radios have no question attached (the agent answers blind)
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

<!-- Template:
### B1: short title
- **Command:**
- **What happened:**
- **Expected:**
- **Terminal output:**
- **Suspected file:line:**
- **Messaged Aayush:** yes/no, time
-->

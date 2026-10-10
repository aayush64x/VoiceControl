# Voice Browser Agent: build plan

Hack Midwest, October 10 to 11, 2026. Submissions due 8:00 AM Sunday. Demos at 9:00 AM.

## Goal

You say the goal, and the browser does the clicks.

- **For:** people who can't easily use a mouse or keyboard, such as someone with a spinal cord injury.
- **Prize target:** AWS challenge, best use of the Strands Agents SDK.
- **The line:** "Siri can tell you the weather. It can't fill out your benefits form. This can."
- **Definition of done:** one spoken sentence fills the disability benefits form, the agent asks for anything missing, and reads the results. It works live, every time.

## Features, in build order

| # | Feature | Example | Cut if late? |
| --- | --- | --- | --- |
| 1 | General browser control | "Scroll down," "go back," "open usa.gov," "click 7," "search for wheelchair ramps" | Never |
| 2 | Disability benefits form (main demo) | "Check what disability benefits I might qualify for." | Never |
| 3 | Second form, to prove it isn't hardcoded | "Request a doctor's appointment for Tuesday afternoon." | Only if 2 is late |
| 4 | Find an article and read it aloud | "Find today's top story on NPR and read it to me." | Third to go |
| 5 | YouTube | "Find a video on wheelchair transfers and play it." | Second to go |
| 6 | Google | "Search for accessible vans, open the third result." | First to go |

Feature 1 is the foundation. Every other feature uses its clicking, typing and page reading.

## Where Strands is used

Strands is required for the AWS challenge, and it has to be visible.

- **The agent:** a Strands agent runs the loop. It reads the sentence, picks a tool, checks the result, and repeats.
- **The tools:** each tool is a Python function registered with Strands.
- **The pause:** "Submit?" and missing-detail questions use Strands' human-in-the-loop support.
- **The step list:** Strands' streaming events feed the side panel, so every tool call shows by name.
- **The model:** Amazon Bedrock, the Strands default provider. One text model, a Claude Sonnet model by default.
- **In the pitch:** say "built on the Strands Agents SDK" out loud and show the tool calls on screen.

## How it is built

A browser extension is the face and hands. A small Python backend is the brain.

| Part | Where it runs | Job |
| --- | --- | --- |
| Side panel | Extension | Mic button, shortcut key, typed box, step list, Confirm and Cancel buttons, spoken replies |
| Page script | Extension, inside the web page | Numbers every button, link and field. Clicks, types, scrolls, reads text. |
| Bridge | Side panel to backend | Live connection on localhost |
| Strands agent | Python backend | Plans steps, calls tools, pauses for the user |
| Tools | Python backend | Send one command to the extension and wait for the answer |
| Quick commands | Python backend, plain code | "Scroll down," "go back," "yes," "no," "stop," "click 12." No model call. |
| Saved details | Local JSON file | Made-up user details. No database. |

### Tools

| Tool | What it does |
| --- | --- |
| `read_page` | Returns a short numbered outline of the page: sections, buttons, links, fields with their labels |
| `act` | Click, type, scroll, go back, open a URL, press a key. Takes an element number. |
| `fill_form` | Fills many fields in one command, given a list of element numbers and values |
| `read_aloud` | Returns the main text of the page, without menus or ads, for the panel to speak |
| `ask_user` | Pauses and asks the user a question or a yes/no |

### How clicking works

- The page script gives each clickable thing a number in the outline: "7: Next button," "8: Email field."
- The agent says which number to act on. It never guesses positions.
- The page script scrolls the element into view, then clicks it.
- After each action, the page is read again to check that something changed.
- On request, number tags show on the page, so "click 12" works instantly with no model call.

### Messages between the parts

Agree on these in the first hour so the panel can be built against made-up data.

| From | To | Message | Carries |
| --- | --- | --- | --- |
| Panel | Backend | user said | The sentence as text |
| Backend | Panel | step | Tool name, what went in, what came back, status |
| Backend | Panel | ask | The question, and whether it is yes/no |
| Panel | Backend | answer | The user's reply, spoken, typed or a button press |
| Backend | Panel | say | Text for the panel to speak |
| Backend | Page script (through the panel) | command | read page, click N, type into N, scroll, press key |
| Page script | Backend | result | The outline, or success/failure of the action |

### Planned layout

```
voice-agent/
  extension/
    manifest        permissions and the shortcut key
    side panel      mic, typed box, step list, confirm buttons
    page script     number elements, read, click, type, scroll
  backend/
    server          live connection to the side panel
    agent           the Strands agent and its instructions
    tools/          read_page, act, fill_form, read_aloud, ask_user
    quick_commands  plain-code matches
    user_details    made-up saved details
  test-form/        one plain local form, for testing only
  README
  plan.md
```

## Target pages

Demos use real pages. The local form is only for testing code and as the wifi-is-down backup.

| Use | Page | Status |
| --- | --- | --- |
| Main demo | usa.gov/benefit-finder, disability path | Page exists. Questions and field types not checked yet. |
| Second form | Our own Google Form (appointment request) | Make it today. Answers go to us. |
| Article reading | Wikipedia, NPR | Test |
| YouTube | youtube.com | Test |
| First wiring test | weather.gov forecast box | Confirmed: one text box, no login |

- Never submit made-up details to a real business or agency form that sends to people.
- The benefit finder needs a by-hand walkthrough first: every question, every field type, how many pages.

## Team

| Who | Owns |
| --- | --- |
| Aayush | Extension logic, page script, bridge, backend, Strands agent, tools, voice, pitch |
| Teammate | Setup, pipeline and testing. The full list with a test for each task is in tasks.md. |

Commit to git after every working step. Five-minute check-in every two hours.

## Build order

The build is nine slices. Each slice ends with something we can see working, and we commit before starting the next.

| Slice | Target | Done when |
| --- | --- | --- |
| 0. Setup | 11:00 AM | A tiny Strands agent prints an answer, so AWS works. Repo exists. Message format agreed. |
| 1. See the page | 11:30 AM | Clicking "List elements" on weather.gov shows a numbered list of its buttons, links and fields. |
| 2. Touch the page | 12:15 PM | Typed commands like "click 7" and "type into 3" fill the weather box and press Go. |
| 3. The bridge | 1:00 PM | A command typed into the Python backend clicks a button in the real browser. One step is timed. |
| 4. The agent drives | 3:00 PM | "Get the forecast for Kansas City" typed in, and the Strands agent does it alone. Tool calls show in the step list. |
| 5. General control | 4:30 PM | Scroll, back, open a site, click by number and stop all work as plain-code commands on three sites. Benefit finder decision made. |
| 6. The form | 7:00 PM | The benefits form (or the Google Form) completes from one typed sentence, including a missing-detail question. |
| 7. Voice | 10:00 PM | The whole form task works by voice. "Yes" and "no" work by voice and by button. The second form works. |
| 8. Range | Midnight to 4 AM | Article reading, then YouTube, then Google. One hour each at most. |
| 9. Freeze | 4:00 to 8:00 AM | No new code. Rehearse, fix only what breaks the demo, record the backup video, submit. |

Targets are estimates. The order should not change.

### What each slice adds

- **Slice 0:** repo, plan.md, a minimal Strands agent with one tiny tool.
- **Slice 1:** extension skeleton. Side panel with a "List elements" button. Page script that numbers every visible button, link and field.
- **Slice 2:** page script actions: click N, type into N, scroll, go back. A small command box in the panel for testing.
- **Slice 3:** live connection between the side panel and the backend. Commands go out, results come back.
- **Slice 4:** the bridge commands wrapped as Strands tools `read_page` and `act`. Step messages streamed to the panel.
- **Slice 5:** quick commands in plain code, and number tags shown on the page.
- **Slice 6:** `fill_form`, the saved-details file, `ask_user`, and support for radio buttons and dropdowns.
- **Slice 7:** mic button, speech to text, spoken replies, shortcut key, Confirm and Cancel buttons.
- **Slice 8:** `read_aloud` with main-text extraction, YouTube keys, Google results.

### Parallel work

- **Slice 0:** teammate does tasks 1 to 4 in tasks.md: repo, Python setup, AWS access, organizer questions.
- **Slices 1 to 3:** teammate does tasks 5 to 7: benefit finder walkthrough, Google Form, run script.
- **Slices 4 to 7:** teammate does tasks 8 to 10: saved-details file, local test form, side panel look.
- **From midnight:** teammate does tasks 11 and 12: testing, demo laptop, backup video, submission.

### How to run each slice

1. Tell Claude: "Read plan.md. Build only this slice."
2. Test the "done when" by hand.
3. Paste any error back exactly.
4. Commit.
5. Ask for an explanation of what changed before moving on.

### Cut lines

- **Step 3 not done by 1 PM:** drop the extension. The backend drives its own browser window. Agent and tools stay.
- **Benefit finder too hard at 4:30 PM:** the Google Form becomes the main demo, with the same staging.
- **Step 6 not done by 7 PM:** features 4, 5 and 6 are cut.
- **4 AM:** stop building, whatever state it is in.

## Demo

Three minutes, live, no slides. Be signed in before it starts.

1. **Show the pain.** Scroll through the long benefits form for five seconds.
2. **Step back, hands off.** "Check what disability benefits I might qualify for."
3. **The form answers itself** while the step list shows each tool call.
4. **It asks for a missing detail.** We answer out loud.
5. **It reads the results.**
6. **Twenty seconds of range.** One of: read an article aloud, or play a YouTube video.
7. **Close.** "Siri can tell you the weather. It can't do that." Name the limits. Built on the Strands Agents SDK for the AWS challenge.

**Only if it never fails in rehearsal:** let a judge change one detail and say it.

**Backups:** typed box, Confirm and Cancel buttons, headset mic, recorded video.

## Risks

| Risk | What we do |
| --- | --- |
| Extension, backend and AWS don't connect | Step 3 is the proof. Fallback is the driven browser. |
| The benefit finder has widgets we can't handle | Walk through it by hand now. Decide at 4:30 PM. |
| Clicking fails on real pages | Number elements, scroll into view, re-read after each action. Skip pages with broken widgets. |
| Steps are slow on stage | Time one step at 1 PM. Shrink the outline or use a faster model. |
| Mic mishears in a loud hall | Headset mic, shortcut key, typed box, buttons. |
| It looks hardcoded | Second form, missing-detail question, a judge changes a detail. |
| "AI browser agents already exist" | Ours is voice-first, hands-free, built for accessibility, and asks before sending. |
| AI-written code targets an old Strands version | Paste the current docs page before asking for code. |

## Limits we say out loud

- It works on pages it can read. We tested these specific ones.
- We have not tested it with people who would use it.
- Logins and captchas still need the user.
- Page content goes to an AI model, so a real version needs consent and careful handling of private details.
- Voice does not work for everyone.

## Open questions

- Does a browser extension count as a web app under the rules?
- Are AI coding tools allowed?
- Does AWS give credits at the event?
- What does the benefit finder actually ask, and how many pages is it?
- Does the mic work inside the side panel without extra permission steps?


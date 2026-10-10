# Tasks

Commit after every task. Five-minute check-in every two hours.

---

# Aayush — Core build

The hard stuff: extension, backend, bridge, Strands agent, tools, voice.

## Phase 1: Foundation (before 1 PM)

### A1: Extension skeleton + page script
- [ ] Create `extension/manifest.json` with side panel and content script permissions
- [ ] Build page script that numbers every visible button, link, and field on the page
- [ ] Side panel with a "List elements" button that triggers the page script
- [ ] **Done when:** clicking "List elements" on weather.gov shows a numbered list

### A2: Page script actions
- [ ] Implement: click N, type into N, scroll, go back, open URL, press key
- [ ] Element scrolls into view before acting
- [ ] Add a command text box in the side panel for testing
- [ ] **Done when:** typed commands fill the weather.gov box and press Go

### A3: WebSocket bridge
- [ ] Python backend with WebSocket server on localhost
- [ ] Side panel connects and relays commands to/from page script
- [ ] Message format matches plan.md spec
- [ ] Time one round-trip (command → result)
- [ ] **Done when:** a command typed in the Python backend clicks a button in the real browser

### A4: Mic permissions test (quick — do this during any break)
- [ ] Test `navigator.mediaDevices.getUserMedia` inside the side panel
- [ ] If it fails, find the workaround before Slice 7

## Phase 2: Agent (1 PM to 7 PM)

### A5: Strands agent + tools
- [ ] Wrap bridge commands as Strands tools: `read_page`, `act`
- [ ] Create the Strands agent with system prompt
- [ ] Stream step events to the side panel
- [ ] Make model ID configurable via env var (default Sonnet, fallback Haiku)
- [ ] **Done when:** "Get the forecast for Kansas City" typed in → agent does it alone, tool calls show in step list

### A6: Quick commands
- [ ] "scroll down", "go back", "open [url]", "click [N]", "stop", "yes", "no" — handled in plain code, no model call
- [ ] Number overlay tags shown on the page on request
- [ ] **Done when:** quick commands work on 3 different sites

### A7: Form filling
- [ ] Build `fill_form` tool — fills many fields in one command
- [ ] Build `ask_user` tool — pauses agent, asks user a question
- [ ] Handle radio buttons, dropdowns, checkboxes (not just text inputs)
- [ ] Load `user_details.json` for pre-filled data
- [ ] **Done when:** one typed sentence completes the benefits form (or Google Form), including a missing-detail question

## Phase 3: Voice (7 PM to 10 PM)

### A8: Voice input/output
- [ ] Mic button + shortcut key for speech-to-text (Web Speech API)
- [ ] Spoken replies via speech synthesis
- [ ] "Yes" and "No" work by voice and by button
- [ ] Confirm/Cancel buttons for form submissions
- [ ] **Done when:** full form task works entirely by voice

---

# Rylan — Setup, content, testing, demo

The stuff that needs to be right but shouldn't break. No code dependencies on Aayush until Phase 3.

## Phase 1: Setup (before noon)

### R1: Python environment
- [ ] Create `backend/requirements.txt` with: `strands-agents`, `strands-agents-tools`, `websockets`, `boto3`
- [ ] Create a virtualenv, install deps, confirm `python -c "import strands"` works
- [ ] Write a one-line setup instruction in README.md

### R2: AWS / Bedrock access
- [ ] Confirm AWS credentials work: `aws sts get-caller-identity`
- [ ] Confirm Bedrock model access for Claude Sonnet in the region we're using
- [ ] Test a minimal Bedrock call ("hello" → response), note the latency
- [ ] Put the region and model ID in a `.env.example` file (no real keys)

### R3: Answer open questions
- [ ] Ask organizers: does a browser extension count as a web app?
- [ ] Ask organizers: are AI coding tools allowed?
- [ ] Ask organizers: does AWS give credits at the event?
- [ ] Write answers at the bottom of this file when you get them

## Phase 2: Content (noon to 2 PM)

### R4: Benefit finder walkthrough
- [ ] Go to usa.gov/benefit-finder, take the disability path
- [ ] Document every question, field type (text, radio, dropdown, checkbox), and page count
- [ ] Note anything tricky: date pickers, conditional fields, multi-step navigation
- [ ] Save this as `docs/benefit-finder-walkthrough.md`

### R5: Google Form for second demo
- [ ] Create a Google Form: "Doctor Appointment Request"
- [ ] Fields: full name, phone number, preferred date, preferred time (morning/afternoon/evening dropdown), reason for visit
- [ ] Share the form link at the bottom of this file
- [ ] Test that submissions arrive

### R6: Fake user details file
- [ ] Create `backend/user_details.json` with made-up but realistic data:
```json
{
  "first_name": "Jordan",
  "last_name": "Rivera",
  "date_of_birth": "1985-03-14",
  "email": "jordan.rivera@example.com",
  "phone": "816-555-0142",
  "address": "412 Oak Street",
  "city": "Kansas City",
  "state": "Missouri",
  "zip": "64108",
  "disability_type": "spinal cord injury",
  "disability_start_date": "2021-06-10",
  "veteran": false,
  "employed": false,
  "income": "0"
}
```
- [ ] Adjust fields based on what the benefit finder actually asks (from R4)

### R7: Local test form
- [ ] Create `test-form/index.html` — a plain HTML form with: text inputs, radio buttons, a dropdown, a checkbox, and a submit button
- [ ] No frameworks, no styling needed — just every field type we need to handle
- [ ] Confirm it opens in Chrome with `file://` and all fields work

## Phase 3: Polish (2 PM to 10 PM, as Aayush's code lands)

### R8: Run script
- [ ] Create a `run.sh` that starts the backend in one command
- [ ] Print clear instructions for loading the extension in Chrome
- [ ] Test the full startup from scratch on a clean terminal

### R9: Side panel styling
- [ ] Once Aayush has the side panel skeleton, make it look good
- [ ] Dark background, readable text, clear step separation
- [ ] Mic button should be large and obvious
- [ ] Confirm/Cancel buttons big enough to find fast during demo
- [ ] Keep it simple — plain CSS, no frameworks

### R10: Test every tool on every target page
- [ ] `read_page` on: weather.gov, benefit finder, Google Form, Wikipedia, YouTube
- [ ] `act` (click, type, scroll, back) on each
- [ ] `fill_form` on test form and Google Form
- [ ] Note anything broken — tell Aayush immediately
- [ ] Re-test after every fix

---

## Answers to open questions

_Fill these in as you get answers:_

- Does a browser extension count as a web app?  →
- Are AI coding tools allowed?  →
- Does AWS give credits at the event?  →
- Benefit finder: how many pages?  →
- Google Form link:  →

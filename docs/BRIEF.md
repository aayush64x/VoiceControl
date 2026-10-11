# Project Website Brief — Voice Browser Agent

## For: Rylan (designer)
## What to build: A single-page project website hosted on GitHub Pages

---

## Overview

You're building a landing page for our hackathon project. The website explains what our project does, how it works, and lets judges and other hackers understand it quickly. You have full creative freedom on the design — just make sure all the content below is included.

---

## Project Name
**Voice Browser Agent**

## Tagline
"You say the goal, the browser does the clicks."

## One-Liner Pitch
"Siri can tell you the weather. It can't fill out your benefits form. This can."

## What It Is
A Chrome extension + AI backend that lets you control any website using your voice or text commands. Built for people who have difficulty using a mouse or keyboard — like someone with a spinal cord injury, limited mobility, or motor impairment.

## Who It's For
- People with physical disabilities who struggle with mouse/keyboard
- Anyone who wants hands-free web browsing
- Accessibility advocates and organizations

## The Problem
Browsing the web requires constant clicking, scrolling, and typing. For someone who can barely move a mouse, even simple tasks like filling out a form or searching Google become exhausting or impossible. Existing voice assistants can answer questions, but they can't actually DO things on web pages for you.

## Our Solution
You speak a command (or type it), and the AI agent reads the page, figures out what to click/type/scroll, and does it. Multi-step tasks like "fill out this benefits form" work automatically — the agent reads the form, fills in fields, and asks you if anything is missing before submitting.

---

## How It Works (Architecture)

```
User speaks or types a command
        ↓
Chrome Extension (Side Panel)
        ↓ WebSocket
Python Backend (AI Brain)
        ↓
AWS Bedrock (Claude AI via Strands Agents SDK)
        ↓
AI decides what to do → sends action back
        ↓
Chrome Extension clicks/types/scrolls the real page
        ↓
Result shown to user, page updates
```

### The Three Tiers (Smart Routing)
1. **Direct Commands (Instant, no AI):** Simple commands like "click 5" or "scroll down" are executed immediately — no AI call needed, zero latency.
2. **Haiku (Fast AI):** Simple natural language like "click the search button" uses a smaller, faster AI model.
3. **Sonnet (Smart AI):** Complex multi-step tasks like "search for weather in Kansas City" use a more powerful AI model that plans and executes multiple steps.

---

## Available Commands

### Direct Commands (no AI, instant)
| Command | What it does |
|---|---|
| `click 5` | Click element number 5 |
| `type 12 hello world` | Type "hello world" into field 12 |
| `select 8 Missouri` | Choose "Missouri" in dropdown 8 |
| `scroll down` / `scroll up` | Scroll the page |
| `back` | Go back one page |
| `open weather.gov` | Navigate to a website |
| `new tab` | Open a new tab (goes to Google) |
| `new tab youtube` | Open YouTube in a new tab |
| `list` | Show all interactive elements on the page |

### Natural Language (AI-powered)
| What you say | What happens |
|---|---|
| "Search for weather in Kansas City" | Agent finds the search box, types the query, clicks search |
| "Click the login button" | Agent reads the page, finds the login button, clicks it |
| "Fill out this form with my information" | Agent reads all form fields and fills them in one go |
| "Go to YouTube and search for wheelchair transfers" | Agent navigates to YouTube and performs the search |
| "Check what disability benefits I might qualify for" | Agent navigates the benefits form, answers questions, reads results |

---

## Tech Stack

| Technology | Role |
|---|---|
| **Chrome Extension (Manifest V3)** | The UI — side panel with voice button, command input, element list |
| **Content Script** | Scans every page for buttons, links, fields — assigns numbers to each |
| **WebSocket** | Real-time bridge between the extension and the Python backend |
| **Python Backend** | Runs the AI agent, routes commands, manages state |
| **AWS Strands Agents SDK** | The agent framework — plans steps, calls tools, handles multi-step tasks |
| **Amazon Bedrock (Claude)** | The AI model that understands commands and decides actions |

---

## Key Features

- **Voice Control** — click the mic, speak a command, and the agent carries it out
- **Smart Element Detection** — every button, link, and field on the page gets a number
- **Form Filling** — fill entire forms with one command
- **Multi-Step Tasks** — "search for X" involves reading the page, finding the search box, typing, and clicking submit — all automatic
- **Three-Tier Routing** — simple commands skip the AI entirely for instant response
- **New Tab Support** — "new tab" or "new tab youtube" opens a new tab ready to use
- **Works on Any Website** — not hardcoded to specific sites

---

## Built With / Credits

- **Hackathon:** Hack Midwest 2026 (October 10-11)
- **Challenge:** AWS — Best use of Strands Agents SDK
- **Team:** Aayush Nakarmi, Rylan
- **AI Models:** Claude via Amazon Bedrock
- **Framework:** Strands Agents SDK by AWS

---

## Design Notes

- **Dark theme** preferred — the extension uses these colors:
  - Background: `#1a1a2e`
  - Text: `#e0e0e0`
  - Accent/buttons: `#ff6600`
  - Links/values: `#4a9eff` and `#6a9fff`
  - Success: `#8f8`
  - Error: `#f88`
- Keep it **one page**, scrollable
- **Mobile-friendly** — judges might check on their phones
- Include the architecture diagram visually (not just text)
- Add a section for screenshots/demo (we'll add actual screenshots later — leave placeholder boxes for now)
- Put the GitHub repo link: `github.com/aayush64x/VoiceControl`
- The tone should be: **confident, accessible, human** — not corporate, not overly technical

---

## Setup Instructions (for the page)

```
# Clone the repo
git clone https://github.com/aayush64x/VoiceControl.git
cd VoiceControl

# Install Python dependencies
pip install -r backend/requirements.txt

# Set AWS credentials (get from Workshop Studio)
export AWS_DEFAULT_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_SESSION_TOKEN="your-token"

# Load the Chrome extension
# 1. Go to chrome://extensions
# 2. Enable Developer Mode
# 3. Click "Load unpacked" → select the extension/ folder

# Run the agent
python backend/agent.py

# Open the side panel in Chrome and start talking
```

---

## File Setup

1. Put the website files in the `docs/` folder in the repo
2. The main file should be `docs/index.html`
3. In GitHub repo settings → Pages → set source to `main` branch, `/docs` folder
4. The site will be live at: `aayush64x.github.io/VoiceControl`

---

## Placeholder Content Needed

- [ ] Screenshot of the side panel showing element list
- [ ] Screenshot of a command being executed
- [ ] Short demo GIF or video (we'll record later)
- [ ] Team photos (optional)

Use placeholder boxes with text like "Screenshot coming soon" for now. We'll replace them with real images later.

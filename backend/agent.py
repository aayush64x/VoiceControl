"""Strands agent that drives the browser through the WebSocket bridge.

Three tiers:
  1. Direct commands (no AI): "click 5", "scroll down", "open weather.gov"
  2. Haiku (simple one-step): "click the search button", "type my name"
  3. Sonnet (multi-step): "search for weather in Kansas City", "fill out this form"
"""

import asyncio
import json
import os
import re
import time
from urllib.parse import quote_plus

import boto3
from dotenv import load_dotenv
from strands import Agent, tool
from strands.hooks import AfterToolCallEvent, BeforeToolCallEvent
from strands.models import BedrockModel

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import server
import site_memory
from memory_store import LocalMemoryStore
from strands.memory import MemoryManager

_memory_store = LocalMemoryStore()
_memory_manager = MemoryManager(
    stores=[_memory_store],
    add_tool_config=True,
    injection=True,
)

_server_loop = None

HAIKU = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
SONNET = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"


# ---------------------------------------------------------------------------
# Tier 1: direct command parser — no model call
# ---------------------------------------------------------------------------

_DIRECT_PATTERNS = [
    (r"^click\s+(\d+)$", lambda m: ("click", int(m.group(1)), None)),
    (r"^type\s+(\d+)\s+(.+)$", lambda m: ("type", int(m.group(1)), m.group(2))),
    (r"^select\s+(\d+)\s+(.+)$", lambda m: ("select", int(m.group(1)), m.group(2))),
    (r"^scroll\s+(up|down)$", lambda m: ("scroll", None, m.group(1))),
    (r"^scroll$", lambda m: ("scroll", None, "down")),
    (r"^back$", lambda m: ("back", None, None)),
    (r"^open\s+(https?://\S+|[\w.-]+\.\w{2,})$", lambda m: ("open", None, m.group(1))),
    (r"^list$", lambda m: ("list", None, None)),
    # Number tags on the page: "show numbers", "hide numbers", "overlay on/off", "turn numbers off"
    (r"^(?:show|turn on|enable)\s+(?:the\s+)?(?:numbers?|number tags|overlays?)$", lambda m: ("overlays", None, "on")),
    (r"^(?:hide|turn off|disable|remove)\s+(?:the\s+)?(?:numbers?|number tags|overlays?)$", lambda m: ("overlays", None, "off")),
    (r"^(?:turn\s+)?(?:the\s+)?(?:numbers?|overlays?)\s+(on|off)$", lambda m: ("overlays", None, m.group(1).lower())),
]

# Site commands: "search X", "play X on youtube", "ask chatgpt X".
# These say WHAT to do; site memory knows WHERE (each site's search/chat box,
# learned on first visit). No per-site rules here.
_NOT_A_QUERY = re.compile(r"^(it|this|that|them|the (first|second|third|next|last|top)\b|the video|this video)", re.IGNORECASE)


def parse_site_command(text):
    """Return {"action": "search"|"ask", "query", "site" (named site or None), "verb"} or None."""
    t = text.strip().rstrip(".!")
    m = re.match(r"^(?:ask|tell)\s+(chat\s?gpt|claude|gemini|perplexity|copilot)\s+(?:to\s+)?(.+)$", t, re.IGNORECASE)
    if m:
        return {"action": "ask", "site": m.group(1), "query": m.group(2), "verb": "ask"}
    m = re.match(r"^(search(?: for)?|look up|find|play|watch)\s+(.+?)\s+on\s+([\w.-]+(?:\s[\w.-]+)?)$", t, re.IGNORECASE)
    if m and not _NOT_A_QUERY.match(m.group(2)) and m.group(3).lower() not in ("this page", "the page", "here", "this site"):
        return {"action": "search", "site": m.group(3), "query": m.group(2), "verb": m.group(1).split()[0].lower()}
    m = re.match(r"^search\s+([\w.-]+)\s+for\s+(.+)$", t, re.IGNORECASE)
    if m:
        return {"action": "search", "site": m.group(1), "query": m.group(2), "verb": "search"}
    # "find" is left out of the bare form: "find the login button" isn't a search
    m = re.match(r"^(search(?: for)?|look up|play|watch)\s+(.+)$", t, re.IGNORECASE)
    if m and not _NOT_A_QUERY.match(m.group(2)):
        return {"action": "search", "site": None, "query": m.group(2), "verb": m.group(1).split()[0].lower()}
    m = re.match(r"^ask\s+(.+)$", t, re.IGNORECASE)
    if m:
        return {"action": "ask", "site": None, "query": m.group(1), "verb": "ask"}
    return None


_URLISH = re.compile(r"^(https?://\S+|[\w-]+(\.[\w-]+)*\.[a-z]{2,}(/\S*)?)$", re.IGNORECASE)


def _known_site_url(name):
    """URL for a site the user named — only if it's an address or a site we've learned.

    Unknown names return None so the AI resolves them: it knows "Claude" is
    claude.ai and can see through voice mishearings ("Chad GPT"), where a
    blind name.com guess lands on junk (chadgpt.com).
    """
    name = (name or "").strip()
    if not name:
        return None
    if _URLISH.match(name.replace(" ", "")) and "." in name:
        return name if name.lower().startswith("http") else "https://" + name.replace(" ", "")
    domain = site_memory.find_similar(name)
    return "https://" + domain if domain else None


# "new tab", "new tab youtube", "open youtube in a new tab", "open a new tab with weather.gov"
_NEW_TAB_PATTERNS = [
    re.compile(r"^(?:open\s+)?(?:a\s+)?new\s+tab(?:\s+(?:with|for|to|and open|and go to)?\s*(.*))?$", re.IGNORECASE),
    re.compile(r"^(?:open|go to|launch|load)?\s*(.+?)\s+(?:in|on|into)\s+(?:a\s+)?new\s+tab$", re.IGNORECASE),
]


def _parse_new_tab(text):
    """Return the target ("" for a blank new tab) if this is a new-tab command, else None."""
    for pattern in _NEW_TAB_PATTERNS:
        m = pattern.match(text)
        if m:
            return (m.group(1) or "").strip()
    return None


def try_direct(text):
    stripped = text.strip().rstrip(".!")

    # New tab: instant for a blank tab, an address, or a site already learned.
    # Anything else (an unknown or misheard name) goes to the AI, which has
    # its own new_tab action.
    target = _parse_new_tab(stripped)
    if target is not None:
        if not target:
            return ("new_tab", None, "https://google.com")
        url = _known_site_url(target)
        return ("new_tab", None, url) if url else None

    for pattern, extract in _DIRECT_PATTERNS:
        m = re.match(pattern, stripped, re.IGNORECASE)
        if m:
            return extract(m)
    return None


# ---------------------------------------------------------------------------
# bridge helper — call async server funcs from sync agent-tool thread
# ---------------------------------------------------------------------------

def _bridge(coro, timeout=15):
    if _server_loop is None:
        return {"error": "Server not started."}
    fut = asyncio.run_coroutine_threadsafe(coro, _server_loop)
    try:
        return fut.result(timeout=timeout)
    except TimeoutError:
        return {"error": "Timed out waiting for browser response."}
    except Exception as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Strands tools
# ---------------------------------------------------------------------------

def _format_page(result):
    """Format page data into a string for the agent."""
    lines = [f"Page: {result.get('title', 'Unknown')} — {result.get('count', 0)} elements"]
    context = result.get("context") or {}
    if context.get("headings"):
        lines.append("Headings: " + " | ".join(context["headings"]))
    if context.get("errors"):
        lines.append("ERRORS ON PAGE: " + " | ".join(context["errors"]))
    for el in result.get("elements", []):
        line = f"  {el['num']}: [{el['type']}] {el['label']}"
        if el.get("value"):
            line += f" = {el['value']}"
        lines.append(line)
    return "\n".join(lines)


@tool
def read_page() -> str:
    """Read the current web page. Returns the page title and a numbered list of all interactive elements.

    Always call this before acting so you know the current element numbers.
    Call again after any navigation because numbers change on new pages.
    """
    result = _bridge(server.list_elements())
    if not result or "error" in result:
        # Usually the page is mid-load — give it a moment and try once more
        time.sleep(1.5)
        result = _bridge(server.list_elements())
    if not result or "error" in result:
        # Report the failure rather than an old snapshot — acting on stale
        # element numbers clicks the wrong things.
        err = result.get("error", "unknown") if result else "no response"
        return (
            f"Error reading page: {err} The page may still be loading, it may have FAILED to load "
            "(the address doesn't exist), or it is a browser page the extension can't control "
            "(chrome://, Web Store, PDF). Try read_page once more; if it still fails, don't keep "
            "acting on this page — go back or open a different, well-known address."
        )
    return _format_page(result)


@tool
def read_text() -> str:
    """Read the main text of the current page: article body, forecast, search results, form results.

    read_page only lists buttons, links and fields. Use read_text when you need what the
    page SAYS (temperatures, prices, article text, eligibility results), or when the user
    asks you to read something aloud.
    """
    result = _bridge(server.read_text())
    if not result or result.get("error"):
        err = result.get("error", "no response") if result else "no response"
        return f"Error reading page text: {err}"
    text = result.get("text") or "(no readable text found)"
    note = "\n[Text was cut off — this is the first part of the page.]" if result.get("truncated") else ""
    return f"Text of '{result.get('title', '')}':\n{text}{note}"


@tool
def act(action: str, element: int = 0, value: str = "", submit: bool = False) -> str:
    """Perform one action on the page.

    Args:
        action: click, type, select, scroll, back, open, new_tab, read, press_key,
            search (finds the site's search box itself — no element needed),
            ask (types into a chat assistant's message box and sends — no element needed)
        element: Element number from read_page (required for click/type/select)
        value: Text to type, option to select, scroll direction, URL to open, or key name
        submit: With "type" only — also submit after typing (press Enter / click Send).
            Use for search boxes and chat boxes so it takes one step instead of two.

    Examples:
        act("click", 7)                            — click element 7
        act("type", 12, "Kansas City")              — type into field 12
        act("type", 3, "cat videos", True)          — type into search box 3 and submit
        act("select", 5, "Missouri")                — choose dropdown option
        act("scroll", 0, "down")                    — scroll page down
        act("back")                                 — go back
        act("new_tab", 0, "https://claude.ai")      — open a site in a NEW tab
        act("search", 0, "cat videos")              — search this site
        act("ask", 0, "What is the biggest animal?") — send a message in a chat app
        act("open", 0, "https://weather.gov")       — navigate to URL
    """
    elem = element if element > 0 else None
    val = value if value else None
    # Actions that load a new page wait for it (up to ~10s), so allow longer than usual
    if action == "new_tab":
        if not val:
            return "Error: new_tab needs a URL as the value."
        url = val if val.startswith("http") else "https://" + val
        result = _bridge(server.open_new_tab(url), timeout=25)
        if not result or result.get("error"):
            return f"Error: {(result or {}).get('error', 'no response')}"
        title = result.get("page_title")
        return f"Done: opened a NEW TAB at {url}" + (f" — loaded {title!r}." if title else ". It may still be loading.")
    if action in ("search", "ask"):
        result = _bridge(_site_action(action, val), timeout=25)
    else:
        result = _bridge(server.do_action(action, element=elem, value=val, submit=submit), timeout=25)

    if not result:
        return "Error: no response from browser."
    if result.get("error"):
        return f"Error: {result['error']}"

    parts = [f"Done: {result.get('action', action)}"]
    if result.get("label"):
        parts.append(f"on '{result['label']}'")
    page = result.get("page")
    if page == "loaded":
        title = result.get("page_title")
        parts.append(f"— new page loaded{f': {title!r}' if title else ''}.")
    elif page == "no_navigation":
        parts.append("— no new page loaded (the page may have updated in place).")
    elif page == "slow":
        parts.append("— a new page is still loading. Call read_page; if it errors, try once more.")
    elif result.get("navigated"):
        parts.append("— page navigated, call read_page to see the new page")
    elif result.get("changed") is False and action in ("click", "select"):
        parts.append("— nothing on the page changed")
    if result.get("submitted"):
        parts.append("and submitted" + (" (clicked Send)" if result.get("sentWith") else ""))
    if result.get("warning"):
        parts.append(f"— WARNING: {result['warning']}")
    if result.get("verified") is False:
        parts.append("— WARNING: value may not have been set correctly, verify with read_page")
    if _page_changed(result, action):
        return " ".join(parts) + _fresh_page_text()
    return " ".join(parts)


def _page_changed(result, action):
    """Did this action bring up a new page or new content (e.g. the next question)?

    Selecting a radio/checkbox changes the page a little, but isn't worth a re-read.
    """
    if not isinstance(result, dict) or result.get("error"):
        return False
    if result.get("page") in ("loaded", "slow") or result.get("navigated"):
        return True
    return bool(result.get("changed")) and "checked" not in result and action in ("click", "select")


def _fresh_page_text():
    """The updated page, attached to an action's result — saves the agent a read_page step."""
    listing = _bridge(server.list_elements())
    if not listing or listing.get("error"):
        return " Call read_page to see the page now."
    return "\n\nPage now (already fresh — no need to call read_page):\n" + _format_page(listing)


@tool
def fill_form(fields: list[dict]) -> str:
    """Fill multiple form fields in one call. Faster than calling act for each field.

    Args:
        fields: List of dicts, each with:
            element (int): element number from read_page
            value (str): text to type or option to select
            action (str): "type", "select", or "click" — defaults to "type"

    Example:
        fill_form([
            {"element": 12, "value": "John Smith"},
            {"element": 13, "value": "john@email.com"},
            {"element": 14, "value": "Kansas City", "action": "select"},
            {"element": 15, "action": "click"}
        ])
    """
    if not fields:
        return "Error: no fields provided."

    ok_count = 0
    fail_count = 0
    lines = []
    page_changed = False

    for i, field in enumerate(fields, 1):
        elem = field.get("element")
        if elem is None:
            lines.append(f"  {i}. SKIP — no element number")
            fail_count += 1
            continue

        val = field.get("value")
        fa = field.get("action", "type")
        if fa in ("checkbox", "radio"):
            fa = "click"

        result = _bridge(server.do_action(fa, element=elem, value=val), timeout=25)
        page_changed = page_changed or _page_changed(result, fa)

        if not result or result.get("error"):
            err = result.get("error", "no response") if result else "no response"
            lines.append(f"  {i}. element {elem}: FAIL — {err}")
            fail_count += 1
        else:
            label = result.get("label", f"element {elem}")
            note = {"loaded": " — new page loaded", "slow": " — new page still loading"}.get(result.get("page"), "")
            lines.append(f"  {i}. {label}: OK{note}")
            ok_count += 1

    summary = f"Filled {ok_count}/{ok_count + fail_count} fields."
    if fail_count:
        summary += f" {fail_count} failed — read_page and check element numbers."
    text = summary + "\n" + "\n".join(lines)
    return text + _fresh_page_text() if page_changed else text


_CANCELLED_ANSWER = "The user gave a new command instead of answering. Stop this task now and take no further actions."


@tool
def ask_user(question: str, yes_no: bool = False) -> str:
    """Ask the user a question and wait for their answer.

    Use this when you need information that is NOT in the saved user details.
    For yes/no questions (like "Should I submit this form?"), set yes_no=True.

    Args:
        question: The question to ask the user
        yes_no: If True, the user sees Yes/No buttons instead of a text input
    """
    result = _bridge(server.ask_user(question, yes_no), timeout=125)
    if result and result.get("cancelled"):
        return _CANCELLED_ANSWER
    if not result or "error" in result:
        err = result.get("error", "no response") if result else "no response"
        return f"Error asking user: {err}"
    return result.get("answer", "No answer provided.")


# ---------------------------------------------------------------------------
# Step stream — every tool call shows in the side panel as it happens
# ---------------------------------------------------------------------------

def _emit(msg):
    """Send a message to the side panel from any thread, without waiting."""
    if _server_loop is None:
        return
    asyncio.run_coroutine_threadsafe(server._send_to_client(msg), _server_loop)


def _short(text, limit=90):
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _describe_input(name, inp):
    """One-line summary of a tool's input for the step list."""
    inp = inp or {}
    if name == "read_page":
        return ""
    if name == "act":
        parts = [inp.get("action", "")]
        if inp.get("element"):
            parts.append(f"#{inp['element']}")
        if inp.get("value"):
            parts.append(f'"{inp["value"]}"')
        if inp.get("submit"):
            parts.append("+ submit")
        return " ".join(parts)
    if name == "fill_form":
        fields = inp.get("fields") or []
        return f"{len(fields)} field{'s' if len(fields) != 1 else ''}"
    if name == "ask_user":
        return inp.get("question", "")
    return _short(json.dumps(inp, ensure_ascii=False), 70)


def _result_text(result):
    if isinstance(result, Exception):
        return f"Error: {result}"
    try:
        return " ".join(c.get("text", "") for c in result.get("content", []) if isinstance(c, dict))
    except AttributeError:
        return str(result)


def _on_before_tool(event: BeforeToolCallEvent):
    tu = event.tool_use
    _emit({
        "type": "step",
        "step_id": tu.get("toolUseId"),
        "tool": tu.get("name"),
        "input": _short(_describe_input(tu.get("name"), tu.get("input"))),
        "status": "running",
    })


def _on_after_tool(event: AfterToolCallEvent):
    tu = event.tool_use
    text = _result_text(event.result)
    failed = (
        isinstance(event.result, Exception)
        or (isinstance(event.result, dict) and event.result.get("status") == "error")
        or text.startswith("Error")
        or "FAIL" in text
    )
    first_line = text.strip().split("\n")[0] if text.strip() else ""
    _emit({
        "type": "step",
        "step_id": tu.get("toolUseId"),
        "tool": tu.get("name"),
        "status": "cancelled" if event.cancel_message or text.startswith(_CANCELLED_ANSWER[:30])
        else ("error" if failed else "ok"),
        "detail": _short(first_line, 110),
        "ms": round(event.duration * 1000) if event.duration is not None else None,
    })


# ---------------------------------------------------------------------------
# Agent setup
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a browser controller. You convert user commands into browser actions. \
You NEVER answer from your own knowledge. You ONLY use tools.

Workflow:
1. read_page to see the current page
2. Act on elements by number
3. read_page again after navigation or when verifying results

Efficiency rules:
- Take the SHORTEST path. Use search boxes instead of browsing menus.
- Combine multiple field fills into one fill_form call.
- Do NOT go back and retry more than once. If stuck, say so and stop.
- Maximum 15 tool calls for ordinary tasks, 40 for filling a multi-page form or questionnaire. \
If not done by then, report progress and stop.

Reading rules:
- read_page shows only controls (buttons, links, fields). To learn what the page SAYS \
(weather, prices, article, results), call read_text.
- If the user asks you to read something aloud / out loud / to them: get it with read_text, \
then make your final reply the text to read — up to about 150 words of plain sentences.

New tabs and site names:
- If the user says "new tab" (e.g. "open Claude in a new tab"), use act("new_tab", 0, url). \
act("open") replaces the CURRENT tab — it is not a new tab.
- Voice commands can mishear names. Pick the well-known site that SOUNDS like what was said: \
"Chad GPT" / "chat GBT" → ChatGPT (chatgpt.com), "Cloud" / "Clawed" → Claude (claude.ai), \
"Cloud Code" → Claude Code. Never open a made-up domain built from a misheard name.

Action rules:
- The first line "[You are on: …]" tells you the current page. Work on THAT page when it can do the \
task (e.g. use its own search box). NEVER open the page you are already on.
- ALWAYS read_page before your first action.
- After any navigation, call read_page — old element numbers are no longer valid.
- Use element numbers from the LATEST read_page (or the latest "Page now" in an action result).
- If an action result includes "Page now", that IS the current page — don't call read_page again.
- If the command is just a topic or phrase (e.g. "Dark Souls 3"), search for it: on the \
current site if it has a search box, otherwise on Google. Do not ask what to do.
- To search the current site: act("search", 0, "query") — finds the site's search box and \
submits in one step. If it reports no search box, type into the right field with \
act("type", N, "query", True) (types AND submits — never type then click separately).
- To send a message to a chat assistant (ChatGPT, Claude, etc.): act("ask", 0, "message").
- To search the web when the current site can't: act("open", 0, "https://www.google.com/search?q=QUERY").
- If act("open", url) fails, search Google for it instead.

Self-correction rules:
- After a search or sending a message, ONE read_page to confirm, then stop. Do not re-search.
- After filling a form or clicking a button, read_page again to verify it worked.
- If read_page shows "ERRORS ON PAGE", fix those fields first, then continue.
- If a click did not navigate or change the page, try a different approach.
- If an element number is stale, call read_page to get fresh numbers.
- Never claim a task is complete without verifying the page shows the expected result.

Form filling rules:
- Use search_memory ONCE at the start to load all saved user details. Don't search again for each question.
- Match form labels to remembered details by meaning (e.g. "First Name" matches remembered first name).
- Radio buttons and checkboxes are shown as "Question → Answer" (e.g. "Are you married? → No"). \
Pick the option whose question AND answer match the user's details.
- Work out answers from saved details when you can (e.g. a 1985 birth date and a 2021 condition start \
means the condition started after their 22nd birthday).
- Split dates into the parts the form asks for (separate Month / Day / Year fields: 03, 14, 1985).
- Multi-page forms and questionnaires (one question per page): answer AND click Next/Continue in ONE \
fill_form call, e.g. fill_form([{"element": 7, "action": "click"}, {"element": 12, "action": "click"}]). \
The result then shows the next question ("Page now") — answer it right away. One step per page.
- For dropdowns, use act("select", element, value).
- For checkboxes and radio buttons, use act("click", element).
- If a form asks for information NOT in memory, use ask_user to ask the user.
- When the user provides new information, use add_memory to save it for next time.
- ALWAYS ask_user before a FINAL submit that sends the user's data (Submit, Send, Apply, Sign up): \
"Ready to submit. Should I go ahead?" Next/Continue between questionnaire pages is NOT a submit — don't ask.
- When a questionnaire shows its results page, call read_text and tell the user in 2-3 short \
sentences what THE PAGE says they may be eligible for, then stop. Report ONLY what read_text shows — \
never add benefits from saved details or your own knowledge, and don't list what the page says \
they are NOT eligible for as if they were.
- Fill as many fields as possible in one fill_form call.

Output rules:
- NEVER answer from your own knowledge. You are not a chatbot.
- NEVER give advice, lists, or information the user didn't ask for.
- NEVER reply with a menu of options or ask what the user meant in plain text. Act on your best guess; \
only use ask_user when you truly cannot continue (e.g. missing form data).
- Your final reply is READ ALOUD: 1-2 short sentences, no lists, no markdown. \
E.g. "Kansas City: clear and 72 degrees, high of 90 tomorrow." or "Searched YouTube for cat videos."
- If you cannot complete the task, say what you tried and stop.
- NEVER claim something a tool didn't do (e.g. "opened in a new tab" after a normal open).
"""

_agents = {}


def _get_agent(tier):
    if tier not in _agents:
        model_id = HAIKU if tier == "haiku" else SONNET
        _agents[tier] = Agent(
            model=BedrockModel(model_id=model_id, region_name="us-east-1"),
            system_prompt=_SYSTEM_PROMPT,
            tools=[read_page, read_text, act, fill_form, ask_user],
            memory_manager=_memory_manager,
        )
        _agents[tier].hooks.add_callback(BeforeToolCallEvent, _on_before_tool)
        _agents[tier].hooks.add_callback(AfterToolCallEvent, _on_after_tool)
    return _agents[tier]


# ---------------------------------------------------------------------------
# Site memory — learn each site once, then go straight to its search/chat box
# ---------------------------------------------------------------------------

_PROFILE_PROMPT = """Classify this website for a voice browser assistant. Reply with ONLY a JSON object:
{"name": "short site name", "type": "one of: video, search engine, weather, chat assistant, shopping, news, encyclopedia, social, email, maps, government, form, other", "summary": "one short sentence: what people do here", "after_search": "open_result if people usually open one result after searching (videos, products); read_text if the answer is shown on the results page (weather, facts); otherwise none"}

Site: DOMAIN
Title: TITLE
Headings: HEADINGS
Search box: SEARCH
Chat box: CHAT"""

# Site types whose search box expects something specific (a location, an
# address) — "search X" there goes to the agent instead of the instant path
_NO_INSTANT_SEARCH = {"weather", "maps", "government", "form", "email"}

_learning = set()


def _profile_site(domain, info):
    """One quick Haiku call: what kind of site is this? Falls back to 'other' on any failure."""
    keys = info.get("keys") or {}
    prompt = (_PROFILE_PROMPT
              .replace("DOMAIN", domain)
              .replace("TITLE", info.get("title") or "")
              .replace("HEADINGS", " | ".join(info.get("headings") or [])[:400])
              .replace("SEARCH", (keys.get("search") or {}).get("label", "none"))
              .replace("CHAT", (keys.get("chat") or {}).get("label", "none")))
    try:
        client = boto3.client("bedrock-runtime", region_name="us-east-1")
        reply = client.converse(
            modelId=HAIKU,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 200, "temperature": 0},
        )
        text = reply["output"]["message"]["content"][0]["text"]
        return json.loads(re.search(r"\{.*\}", text, re.DOTALL).group(0))
    except Exception as exc:
        print(f"[sites] couldn't classify {domain}: {exc}")
        return {"name": (info.get("title") or domain)[:40], "type": "other"}


async def _announce_site(domain):
    """Tell the side panel what we know about the current site."""
    if not domain:
        return
    entry = site_memory.get(domain)
    await server._send_to_client({
        "type": "site",
        "domain": domain,
        "name": entry.get("name") or entry.get("title") or domain,
        "kind": entry.get("type", ""),
        "search": bool(entry.get("search")),
        "chat": bool(entry.get("chat")),
        "known": bool(entry),
    })


async def learn_site(page):
    """Runs in the background on every page load; only does work for sites not yet learned."""
    domain = site_memory.domain_of(page.get("url"))
    if not domain:
        return
    # Don't learn error pages ("WordPress › Error", 404s, empty pages) as if they were the site
    broken = page.get("count", 1) == 0 or re.search(r"\b(error|not found|404|can.t be reached)\b",
                                                     page.get("title") or "", re.IGNORECASE)
    if broken:
        print(f"[sites] not learning {domain}: looks like an error page ({page.get('title')!r})")
        return
    if domain not in _learning and site_memory.needs_learning(domain):
        _learning.add(domain)
        if not site_memory.get(domain):
            await _announce_site(domain)  # shows "Learning <site>…"
        try:
            info = await server.send_command("action", action="site_info")
            if isinstance(info, dict) and not info.get("error") and site_memory.domain_of(info.get("url")) == domain:
                site_memory.remember_elements(domain, info.get("keys") or {}, info.get("title"))
                if "type" not in site_memory.get(domain):
                    loop = asyncio.get_running_loop()
                    profile = await loop.run_in_executor(None, _profile_site, domain, info)
                    site_memory.remember_profile(domain, profile)
                entry = site_memory.get(domain)
                print(f"[sites] learned {domain}: {entry.get('name')} — {entry.get('type')} "
                      f"(search box: {'yes' if entry.get('search') else 'no'}, "
                      f"chat box: {'yes' if entry.get('chat') else 'no'})")
        except Exception as exc:
            print(f"[sites] couldn't learn {domain}: {exc}")
        finally:
            _learning.discard(domain)
    await _announce_site(domain)


async def _site_action(action, query):
    """Search or ask on the current page, using the remembered box if there is one.

    Whatever box actually worked is remembered for next time; a remembered box
    that's gone (site redesign) is forgotten so it gets relearned.
    """
    kind = "chat" if action == "ask" else "search"
    domain = site_memory.domain_of((server.last_page or {}).get("url"))
    remembered = (site_memory.get(domain).get(kind) or {}).get("selector")
    result = await server.do_action(action, value=query, selector=remembered)
    if isinstance(result, dict) and result.get("success") and result.get("selector"):
        site_memory.remember_elements(domain, {kind: {"selector": result["selector"], "label": result.get("label", "")}})
    elif remembered and isinstance(result, dict) and str(result.get("error", "")).startswith("No "):
        site_memory.forget_element(domain, kind)
    return result


async def _run_site_command(cmd):
    """Instant path for "search/play/ask X": no model call when the site's box is known.

    Returns a reply string, ("agent", follow-up instruction) to hand off to the
    agent, or None to let the agent handle the whole command.
    """
    current = site_memory.domain_of((server.last_page or {}).get("url"))
    if cmd["site"]:
        target = site_memory.find_similar(cmd["site"])
        if not target:
            return None  # not learned yet — the AI knows where "etsy" or "Claude" lives
        if target != current:
            _emit({"type": "step", "tool": "act", "input": f"open {target}", "status": "running", "step_id": "site-open"})
            opened = await server.do_action("open", value="https://" + target)
            ok = isinstance(opened, dict) and opened.get("success")
            _emit({"type": "step", "tool": "act", "step_id": "site-open", "status": "ok" if ok else "error",
                   "detail": f"Opened {target}" if ok else str((opened or {}).get("error", "failed"))})
            if not ok:
                return f"Couldn't open {target}."
            current = target
            # The new site may not be learned yet — the box is detected live either way

    entry = site_memory.get(current)
    name = entry.get("name") or current or "this page"
    if cmd["action"] == "search" and not cmd["site"] and entry.get("type") in _NO_INSTANT_SEARCH:
        return None  # e.g. a weather site wants a location — let the agent work it out

    _emit({"type": "step", "tool": "act", "step_id": "site-action", "status": "running",
           "input": f'{cmd["action"]} "{cmd["query"]}"'})
    result = await _site_action(cmd["action"], cmd["query"])
    ok = isinstance(result, dict) and result.get("success")
    _emit({"type": "step", "tool": "act", "step_id": "site-action", "status": "ok" if ok else "error",
           "detail": (f"Used {name}'s {'chat' if cmd['action'] == 'ask' else 'search'} box"
                      f"{' (remembered)' if result.get('found') == 'memory' else ''}") if ok
           else str((result or {}).get("error", "failed"))})

    if ok:
        if cmd["verb"] in ("play", "watch"):
            return ("agent", f'Search results for "{cmd["query"]}" are showing. Click the best matching video so it plays.')
        if cmd["action"] == "ask":
            return f"Asked {name}: {cmd['query']}"
        return f"Searched {name} for {cmd['query']}."

    if cmd["action"] == "search" and not cmd["site"]:
        # Nothing to search on this page — search the web instead
        url = "https://www.google.com/search?q=" + quote_plus(cmd["query"])
        opened = await server.do_action("open", value=url)
        if isinstance(opened, dict) and opened.get("success"):
            return f"Searched Google for {cmd['query']}."
    return None


# ---------------------------------------------------------------------------
# Request classifier
# ---------------------------------------------------------------------------

_SIMPLE_STARTS = (
    "click", "tap", "press", "hit",
    "type", "enter", "write", "input",
    "scroll", "go back", "back", "open", "navigate", "go to",
    "read", "check", "select",
)


def classify(text):
    if try_direct(text) is not None:
        return "direct"
    lower = text.strip().lower()
    if " and " in lower or "?" in lower:
        return "sonnet"
    # Haiku only for clear one-step commands ("click the search button").
    # Anything else goes to Sonnet: it takes fewer wrong turns, which is faster overall.
    for s in _SIMPLE_STARTS:
        if (lower == s or lower.startswith(s + " ")) and len(lower.split()) <= 6:
            return "haiku"
    return "sonnet"


# ---------------------------------------------------------------------------
# Input processing
# ---------------------------------------------------------------------------

async def _run_direct(text):
    action, element, value = try_direct(text)
    if action == "overlays":
        on = value == "on"
        await server._send_to_client({"type": "set_overlays", "on": on})
        return "Numbers shown on the page." if on else "Numbers hidden."
    if action == "list":
        result = await server.list_elements()
        if result and "elements" in result:
            lines = [f"Found {result['count']} elements:"]
            for el in result["elements"]:
                line = f"  {el['num']}: {el['label']} ({el['type']})"
                if el.get("value"):
                    line += f" [{el['value']}]"
                lines.append(line)
            return "\n".join(lines)
        return f"Error: {result}"
    if action == "new_tab":
        result = await server.open_new_tab(value)
        if result and result.get("success"):
            title = result.get("page_title")
            return f"Opened {title or value} in a new tab."
        return f"Couldn't open a new tab: {(result or {}).get('error', 'no response')}"
    result = await server.do_action(action, element=element, value=value)
    if result and result.get("success") and action == "open":
        return f"Opened {value}"
    if result and result.get("success"):
        return f"OK: {json.dumps(result)}"
    return f"Error: {result}"


_running_agent = None


def _with_location(text):
    """Prefix the command with the page the user is on (title + address only).

    Only the location — never the element list, whose numbers may be stale.
    """
    page = server.last_page or {}
    url = page.get("url")
    if not url:
        return text
    title = page.get("title") or "untitled page"
    lines = [f"[You are on: {title} — {url}]"]
    known = site_memory.describe(site_memory.domain_of(url))
    if known:
        lines.append(f"[Site memory: {known}]")
    return "\n".join(lines) + "\n" + text


def cancel_current():
    """Stop the agent task that is running now, if any. Safe from any thread."""
    if _running_agent is not None:
        _running_agent.cancel()


def _run_agent(text, tier):
    global _running_agent
    agent = _get_agent(tier)
    # Each command starts fresh: old page listings would bloat every request and
    # confuse element numbers. Saved user details live in memory, not history.
    agent.messages.clear()
    _running_agent = agent
    try:
        response = agent(_with_location(text))
    finally:
        _running_agent = None
    if getattr(response, "stop_reason", None) == "cancelled":
        return "Stopped."
    return str(response)


async def process_input(text):
    tier = classify(text)
    if tier == "direct":
        print("[tier 1] Direct command — no model call")
        _emit({"type": "step", "tool": "route", "input": "Direct command — no AI", "status": "ok"})
        return await _run_direct(text)

    # Ask the browser which page is open right now, so both the instant path and
    # the agent work on the page the user is looking at (list_elements also
    # records its title/URL). A failure here is fine — they just know less.
    try:
        await server.list_elements()
    except Exception as exc:
        print(f"[agent] couldn't check current page: {exc}")

    # "search / play / ask X": site memory knows where the box is — no model call
    cmd = parse_site_command(text)
    if cmd:
        print(f"[sites] Instant path: {cmd['action']} {cmd['query']!r}" + (f" on {cmd['site']}" if cmd["site"] else ""))
        _emit({"type": "step", "tool": "route", "input": "Site memory · instant (no AI)", "status": "ok"})
        outcome = await _run_site_command(cmd)
        if isinstance(outcome, str):
            return outcome
        if isinstance(outcome, tuple):
            text, tier = outcome[1], "haiku"  # short follow-up, e.g. open the video
        else:
            print("[sites] Instant path can't do this one — handing to the agent")

    label = "Haiku" if tier == "haiku" else "Sonnet"
    print(f"[tier {'2' if tier == 'haiku' else '3'}] Using {label}")
    _emit({
        "type": "step",
        "tool": "route",
        "input": f"Strands agent · Claude {label} ({'quick task' if tier == 'haiku' else 'multi-step task'})",
        "status": "ok",
    })
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _run_agent, text, tier)


# ---------------------------------------------------------------------------
# Chat loop + main
# ---------------------------------------------------------------------------

async def chat_loop():
    print("\n[agent] Ready. Type a command or natural language instruction.")
    print("[agent] Direct: click 5 | type 12 hello | scroll down | open weather.gov")
    print("[agent] Natural: 'search for weather in Kansas City'")
    print("[agent] Type 'quit' to exit.\n")

    loop = asyncio.get_running_loop()

    while True:
        try:
            text = await loop.run_in_executor(None, lambda: input("you> "))
        except (EOFError, KeyboardInterrupt):
            print()
            break

        text = text.strip()
        if not text:
            continue
        if text.lower() in ("quit", "exit"):
            break

        start = time.time()
        try:
            result = await process_input(text)
        except Exception as exc:
            result = f"Error: {exc}"
        elapsed = time.time() - start

        print(f"\nagent> {result}")
        print(f"[{elapsed:.1f}s]")
        print()


async def main():
    global _server_loop
    _server_loop = asyncio.get_running_loop()
    server.on_user_input = process_input
    server.on_cancel = cancel_current
    server.on_page_ready = learn_site

    import websockets as _ws

    print(f"[bridge] Starting on ws://localhost:{server.PORT}")
    try:
        async with _ws.serve(server.handler, "localhost", server.PORT, origins=server.ALLOWED_ORIGINS):
            await chat_loop()
    except OSError as e:
        if "address already in use" in str(e).lower():
            print(f"[bridge] Port {server.PORT} already in use. Stop the other server first.")
        else:
            raise


if __name__ == "__main__":
    asyncio.run(main())

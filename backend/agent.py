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
from urllib.parse import quote_plus, urlparse

from dotenv import load_dotenv
from strands import Agent, tool
from strands.models import BedrockModel

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import server
from memory_store import LocalMemoryStore
from strands.memory import MemoryManager

_memory_store = LocalMemoryStore()
_memory_manager = MemoryManager(
    stores=[_memory_store],
    add_tool_config=True,
    injection=True,
)

_server_loop = None


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
]

_TAB_SHORTCUTS = {
    "youtube": "https://youtube.com",
    "twitter": "https://x.com",
    "google": "https://google.com",
    "gmail": "https://gmail.com",
    "wikipedia": "https://wikipedia.org",
    "reddit": "https://reddit.com",
    "instagram": "https://instagram.com",
    "facebook": "https://facebook.com",
    "amazon": "https://amazon.com",
    "linkedin": "https://linkedin.com",
    "tiktok": "https://tiktok.com",
    "netflix": "https://netflix.com",
}


# Search result pages we can open directly — one navigation instead of
# read page → type → click → verify through the model.
_SEARCH_URLS = {
    "google": "https://www.google.com/search?q={}",
    "youtube": "https://www.youtube.com/results?search_query={}",
    "amazon": "https://www.amazon.com/s?k={}",
    "wikipedia": "https://en.wikipedia.org/w/index.php?search={}",
    "reddit": "https://www.reddit.com/search/?q={}",
    "chatgpt": "https://chatgpt.com/?q={}",
}

_SITE_NAMES = r"(youtube|google|amazon|wikipedia|reddit|chatgpt|chat gpt)"

_SITE_HOSTS = {
    "youtube.com": "youtube",
    "google.com": "google",
    "amazon.com": "amazon",
    "wikipedia.org": "wikipedia",
    "reddit.com": "reddit",
    "chatgpt.com": "chatgpt",
}


def _search_url(site, query):
    site = site.lower().replace(" ", "")
    return _SEARCH_URLS[site].format(quote_plus(query.strip()))


def _current_site():
    """Site key for the page the user is on, if it's one we have a search URL for."""
    url = (server.last_page or {}).get("url") or ""
    host = urlparse(url).hostname or ""
    for domain, site in _SITE_HOSTS.items():
        if host == domain or host.endswith("." + domain):
            return site
    return None


def _try_search(text):
    """Turn "search X on youtube", "ask chatgpt X", "search for X" into a URL."""
    m = re.match(r"^(?:ask|tell)\s+(?:chatgpt|chat gpt)\s+(?:to\s+)?(.+)$", text, re.IGNORECASE)
    if m:
        return _search_url("chatgpt", m.group(1))
    m = re.match(rf"^(?:search|look up|find|play)\s+(?:for\s+)?(.+?)\s+on\s+{_SITE_NAMES}$", text, re.IGNORECASE)
    if m:
        return _search_url(m.group(2), m.group(1))
    m = re.match(rf"^(?:search|look up)\s+{_SITE_NAMES}\s+for\s+(.+)$", text, re.IGNORECASE)
    if m:
        return _search_url(m.group(1), m.group(2))
    m = re.match(r"^(?:search|look up)\s+(?:for\s+)?(.+)$", text, re.IGNORECASE)
    if m:
        # Only shortcut on sites we know; elsewhere let the agent use the page's own search box
        site = _current_site()
        if site:
            return _search_url(site, m.group(1))
    return None


def try_direct(text):
    stripped = text.strip().rstrip(".!")

    url = _try_search(stripped)
    if url:
        return ("open", None, url)

    # "new tab" commands
    m = re.match(r"^new\s+tab(?:\s+(.+))?$", stripped, re.IGNORECASE)
    if m:
        target = (m.group(1) or "").strip().lower()
        if not target:
            return ("new_tab", None, "https://google.com")
        if target in _TAB_SHORTCUTS:
            return ("new_tab", None, _TAB_SHORTCUTS[target])
        if re.match(r"^(https?://\S+|[\w.-]+\.\w{2,})$", target):
            url = target if target.startswith("http") else "https://" + target
            return ("new_tab", None, url)
        return None

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
        # Report the failure rather than an old snapshot — acting on stale
        # element numbers clicks the wrong things.
        err = result.get("error", "unknown") if result else "no response"
        return f"Error reading page: {err}"
    return _format_page(result)


@tool
def act(action: str, element: int = 0, value: str = "", submit: bool = False) -> str:
    """Perform one action on the page.

    Args:
        action: click, type, select, scroll, back, open, read, press_key
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
        act("open", 0, "https://weather.gov")       — navigate to URL
    """
    elem = element if element > 0 else None
    val = value if value else None
    result = _bridge(server.do_action(action, element=elem, value=val, submit=submit))

    if not result:
        return "Error: no response from browser."
    if result.get("error"):
        return f"Error: {result['error']}"

    parts = [f"Done: {result.get('action', action)}"]
    if result.get("label"):
        parts.append(f"on '{result['label']}'")
    if result.get("navigated"):
        parts.append("— page navigated, call read_page to see the new page")
    if result.get("submitted"):
        parts.append("and submitted" + (" (clicked Send)" if result.get("sentWith") else ""))
    if result.get("warning"):
        parts.append(f"— WARNING: {result['warning']}")
    if result.get("verified") is False:
        parts.append("— WARNING: value may not have been set correctly, verify with read_page")
    return " ".join(parts)


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

        result = _bridge(server.do_action(fa, element=elem, value=val))

        if not result or result.get("error"):
            err = result.get("error", "no response") if result else "no response"
            lines.append(f"  {i}. element {elem}: FAIL — {err}")
            fail_count += 1
        else:
            label = result.get("label", f"element {elem}")
            lines.append(f"  {i}. {label}: OK")
            ok_count += 1

    summary = f"Filled {ok_count}/{ok_count + fail_count} fields."
    if fail_count:
        summary += f" {fail_count} failed — read_page and check element numbers."
    return summary + "\n" + "\n".join(lines)


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
        return "The user gave a new command instead of answering. Stop this task now and take no further actions."
    if not result or "error" in result:
        err = result.get("error", "no response") if result else "no response"
        return f"Error asking user: {err}"
    return result.get("answer", "No answer provided.")


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
- Maximum 15 tool calls per task. If not done by then, report progress and stop.

Action rules:
- ALWAYS read_page before your first action.
- After any navigation, call read_page — old element numbers are no longer valid.
- Use element numbers from the LATEST read_page only.
- If the command is just a topic or phrase (e.g. "Dark Souls 3"), search for it: on the \
current site if it has search (YouTube, Amazon, Wikipedia), otherwise on Google. Do not ask what to do.
- Fastest way to search these sites — open the results URL directly (one step):
  Google: https://www.google.com/search?q=QUERY
  YouTube: https://www.youtube.com/results?search_query=QUERY
  Wikipedia: https://en.wikipedia.org/w/index.php?search=QUERY
  Amazon: https://www.amazon.com/s?k=QUERY
  ChatGPT (sends the question): https://chatgpt.com/?q=QUESTION
- On any other site, type into its search box with submit: act("type", N, "query", True). \
This types AND submits in one step — never type then click separately.
- To send a message in a chat box (ChatGPT, etc.), use act("type", N, "message", True). \
Chat boxes may show as [field] with a label like "Ask anything" or "text box".
- If act("open", url) fails, go to Google via its search URL.

Self-correction rules:
- After a search or sending a message, ONE read_page to confirm, then stop. Do not re-search.
- After filling a form or clicking a button, read_page again to verify it worked.
- If a field shows an error message or validation failure, read the error, fix the value, and retry.
- If a click did not navigate or change the page, try a different approach.
- If an element number is stale, call read_page to get fresh numbers.
- Never claim a task is complete without verifying the page shows the expected result.

Form filling rules:
- Use search_memory to find saved user details before filling forms.
- Match form labels to remembered details by meaning (e.g. "First Name" matches remembered first name).
- For dropdowns, use act("select", element, value).
- For checkboxes and radio buttons, use act("click", element).
- If a form asks for information NOT in memory, use ask_user to ask the user.
- When the user provides new information, use add_memory to save it for next time.
- ALWAYS ask_user before submitting a form: "Ready to submit. Should I go ahead?"
- Fill as many fields as possible in one fill_form call.

Output rules:
- NEVER answer from your own knowledge. You are not a chatbot.
- NEVER give advice, lists, or information the user didn't ask for.
- NEVER reply with a menu of options or ask what the user meant in plain text. Act on your best guess; \
only use ask_user when you truly cannot continue (e.g. missing form data).
- Report ONLY what you did: "Opened usa.gov. Clicked Benefits. Found 3 results."
- If you cannot complete the task, say what you tried and stop.
"""

_agents = {}


def _get_agent(tier):
    if tier not in _agents:
        if tier == "haiku":
            model_id = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
        else:
            model_id = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
        _agents[tier] = Agent(
            model=BedrockModel(model_id=model_id, region_name="us-east-1"),
            system_prompt=_SYSTEM_PROMPT,
            tools=[read_page, act, fill_form, ask_user],
            memory_manager=_memory_manager,
        )
    return _agents[tier]


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
    for s in _SIMPLE_STARTS:
        if lower.startswith(s):
            return "haiku"
    if len(lower.split()) <= 4:
        return "haiku"
    return "sonnet"


# ---------------------------------------------------------------------------
# Input processing
# ---------------------------------------------------------------------------

async def _run_direct(text):
    action, element, value = try_direct(text)
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
        result = await server.send_command("new_tab", url=value)
        if result and result.get("success"):
            return f"Opened new tab: {value}"
        return f"Error: {result}"
    result = await server.do_action(action, element=element, value=value)
    if result and result.get("success") and action == "open":
        return f"Opened {value}"
    if result and result.get("success"):
        return f"OK: {json.dumps(result)}"
    return f"Error: {result}"


_running_agent = None


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
        response = agent(text)
    finally:
        _running_agent = None
    if getattr(response, "stop_reason", None) == "cancelled":
        return "Stopped — running your new command."
    return str(response)


async def process_input(text):
    tier = classify(text)
    if tier == "direct":
        print("[tier 1] Direct command — no model call")
        return await _run_direct(text)

    label = "Haiku" if tier == "haiku" else "Sonnet"
    print(f"[tier {'2' if tier == 'haiku' else '3'}] Using {label}")
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

    import websockets as _ws

    print(f"[bridge] Starting on ws://localhost:{server.PORT}")
    try:
        async with _ws.serve(server.handler, "localhost", server.PORT):
            await chat_loop()
    except OSError as e:
        if "address already in use" in str(e).lower():
            print(f"[bridge] Port {server.PORT} already in use. Stop the other server first.")
        else:
            raise


if __name__ == "__main__":
    asyncio.run(main())

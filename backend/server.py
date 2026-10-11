"""WebSocket server that bridges the Strands agent to the Chrome extension."""

import asyncio
import json
import re
import time

import websockets

from transcribe import VoiceTranscriber

PORT = 8765

# Only our Chrome extension may connect. Browsers always send an Origin header,
# so this blocks any website from opening ws://localhost:8765 and driving the
# agent. None allows non-browser clients (tests, scripts) that send no Origin.
# Unpacked extension IDs differ per machine, so any extension ID is accepted.
ALLOWED_ORIGINS = [re.compile(r"chrome-extension://[a-p]{32}"), None]
client = None
pending = {}
request_id = 0
last_page = None

# Page-load tracking: bumped by "page_loading" (a tab started loading) and
# "page_ready" (a page finished loading or a single-page app changed route).
# Actions that navigate wait on these so the agent never reads the old page.
_page_loading_count = 0
_page_ready_count = 0
_loading = False      # a page started loading and hasn't announced itself yet
NAV_START_WAIT = 1.5  # seconds to see any sign of navigation before assuming none happened
NAV_START_WAIT_SUBMIT = 5.0  # forms often run code (lookups, validation) before navigating
NAV_LOAD_WAIT = 8.0   # seconds to wait for the new page once it started loading
UNREACHABLE = "Could not reach"  # prefix of the extension's "page not reachable" error

on_user_input = None
on_cancel = None  # set by agent.py — stops the running agent task
on_page_ready = None  # set by agent.py — async hook to learn new sites
_transcriber = None

# Commands run one at a time, in order. A command sent while another is
# running waits in the queue instead of being dropped.
_command_queue = None
_worker_task = None
_busy = False
_question_rid = None  # request id of the ask_user question currently on screen
_tasks = set()  # keep references so background tasks aren't garbage-collected mid-run


async def _send_to_client(obj):
    """Send to whichever side panel is connected now (it may have reconnected)."""
    if not client:
        return
    try:
        await client.send(json.dumps(obj))
    except websockets.ConnectionClosed:
        pass


_SPEECH_REQUEST = re.compile(
    r"\b(out loud|aloud|read (it|this|that|them)?\s*(to me|for me)|read (it|this|that) (out|to|for)|"
    r"tell me out loud|say it|speak it)\b",
    re.IGNORECASE,
)


def wants_speech(text):
    """Replies are spoken only when the user asked: "read it out loud", "read this to me"."""
    return bool(_SPEECH_REQUEST.search(text or ""))


async def _run_command(text):
    try:
        if not on_user_input:
            await _send_to_client({
                "type": "agent_response",
                "text": "Agent not ready. Start the backend with agent.py.",
            })
            return
        await _send_to_client({"type": "agent_thinking", "text": text})
        print(f"[command] Running: {text}")
        result = await on_user_input(text)
        print(f"[command] Finished: {text}")
        await _send_to_client({"type": "agent_response", "text": str(result), "speak": wants_speech(text)})
    except Exception as exc:
        print(f"[command] Error: {exc}")
        await _send_to_client({"type": "agent_response", "text": f"Error: {exc}"})


async def _command_worker():
    global _busy
    while True:
        text = await _command_queue.get()
        _busy = True
        try:
            await _run_command(text)
        finally:
            _busy = False
            _command_queue.task_done()


def _cancel_open_question():
    """If the agent is waiting on a question, dismiss it and stop that task."""
    global _question_rid
    rid = _question_rid
    if rid is None:
        return False
    _question_rid = None
    future = pending.get(rid)
    if future and not future.done():
        future.set_result({"cancelled": True})
    if on_cancel:
        on_cancel()
    print("[command] New command while a question was open — cancelled current task")
    return True


_STOP_WORDS = {"stop", "cancel", "stop it", "never mind", "nevermind"}


async def stop_everything():
    """'stop': drop queued commands, dismiss any question, and halt the running task."""
    dropped = 0
    if _command_queue is not None:
        while not _command_queue.empty():
            _command_queue.get_nowait()
            _command_queue.task_done()
            dropped += 1
    if _cancel_open_question():
        await _send_to_client({"type": "question_cancelled"})
    if _busy and on_cancel:
        on_cancel()
        # The cancelled task replies "Stopped." itself when it winds down
    else:
        await _send_to_client({"type": "agent_response", "text": "Stopped."})
    print(f"[command] Stop — halted current task, dropped {dropped} queued")


async def enqueue_command(text):
    global _command_queue, _worker_task
    if _command_queue is None:
        _command_queue = asyncio.Queue()
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_command_worker())

    if _cancel_open_question():
        await _send_to_client({"type": "question_cancelled"})

    ahead = _command_queue.qsize() + (1 if _busy else 0)
    await _command_queue.put(text)
    if ahead:
        print(f"[command] Queued ({ahead} ahead): {text}")
        await _send_to_client({"type": "queued", "text": text, "ahead": ahead})


async def handler(websocket):
    global client, _transcriber, last_page, _page_loading_count, _page_ready_count, _loading
    client = websocket
    print("[bridge] Extension connected")
    try:
        async for raw in websocket:
            if isinstance(raw, bytes):
                if _transcriber and _transcriber.running:
                    await _transcriber.feed(raw)
                continue

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                print(f"[bridge] Ignoring malformed message")
                continue

            msg_type = msg.get("type")

            if msg_type == "voice_start":
                if _transcriber and _transcriber.running:
                    await _transcriber.stop(transcribe=False)
                _transcriber = VoiceTranscriber()

                async def on_transcript(text, is_final, error=None):
                    if error:
                        print(f"[voice] {error}")
                    else:
                        print(f"[voice] Heard: {text}")
                    msg_out = {"type": "transcript", "text": text, "is_final": is_final}
                    if error:
                        msg_out["error"] = error
                    await _send_to_client(msg_out)

                await _transcriber.start(on_transcript)
                print("[voice] Recording started")
                continue

            if msg_type == "voice_stop":
                if _transcriber:
                    # Transcribe in the background so this loop keeps handling
                    # messages. The transcript callback sends the result; the
                    # client then sends user_said for agent processing.
                    task = asyncio.create_task(_transcriber.stop(transcribe=not msg.get("cancel")))
                    _tasks.add(task)
                    task.add_done_callback(_tasks.discard)
                    _transcriber = None
                print("[voice] Recording stopped" + (" (cancelled)" if msg.get("cancel") else ", transcribing..."))
                continue

            if msg_type == "user_said":
                text = msg.get("text", "").strip()
                if text.lower().rstrip(".!") in _STOP_WORDS:
                    await stop_everything()
                elif text:
                    await enqueue_command(text)
                continue

            if msg.get("id") in pending:
                pending[msg["id"]].set_result(msg.get("result"))
            elif msg_type == "page_loading":
                _page_loading_count += 1
                _loading = True
                print(f"[bridge] Page loading: {msg.get('url', '?')}")
            elif msg_type == "page_ready":
                last_page = msg
                _page_ready_count += 1
                _loading = False
                print(f"[bridge] Page ready: {msg.get('title', '?')} ({msg.get('count', 0)} elements)")
                if on_page_ready:
                    task = asyncio.create_task(on_page_ready(msg))
                    _tasks.add(task)
                    task.add_done_callback(_tasks.discard)
    except websockets.ConnectionClosed:
        pass
    finally:
        # Only clean up if this is still the active connection. An old side
        # panel closing must not disconnect the one that replaced it.
        if client is websocket:
            print("[bridge] Extension disconnected")
            client = None
            if _transcriber and _transcriber.running:
                await _transcriber.stop(transcribe=False)
                _transcriber = None
            for rid, future in list(pending.items()):
                if not future.done():
                    future.set_result({"error": "Extension disconnected."})
        else:
            print("[bridge] Old side panel connection closed (newer one still active)")


async def send_command(msg_type, timeout=10.0, **kwargs):
    """Send a command to the extension and wait for the result."""
    global request_id
    if not client:
        print(f"[bridge] {msg_type}: FAILED — side panel not connected")
        return {"error": "Extension not connected. Open the side panel in Chrome."}

    request_id += 1
    rid = request_id
    msg = {"id": rid, "type": msg_type, **kwargs}

    future = asyncio.get_running_loop().create_future()
    pending[rid] = future
    detail = " ".join(f"{k}={v}" for k, v in kwargs.items() if k != "question")
    start = time.time()

    try:
        await client.send(json.dumps(msg))
        result = await asyncio.wait_for(future, timeout=timeout)
        ms = (time.time() - start) * 1000
        status = f"error: {result['error']}" if isinstance(result, dict) and result.get("error") else "ok"
        print(f"[bridge] {msg_type} {detail} → {status} ({ms:.0f}ms)")
        return result
    except asyncio.TimeoutError:
        print(f"[bridge] {msg_type} {detail} → TIMEOUT after {timeout:.0f}s")
        return {"error": "Timeout waiting for extension response."}
    except websockets.ConnectionClosed:
        print(f"[bridge] {msg_type} {detail} → side panel disconnected")
        return {"error": "Extension disconnected."}
    finally:
        pending.pop(rid, None)


async def wait_while_loading(timeout=None):
    """If a page is mid-load, wait for it to finish before touching it.

    Pages the extension can't run on (chrome://, PDFs) never announce
    themselves, so give up after the timeout and carry on.
    """
    global _loading
    if not _loading:
        return
    loop = asyncio.get_running_loop()
    deadline = loop.time() + (NAV_LOAD_WAIT if timeout is None else timeout)
    start = loop.time()
    while _loading and loop.time() < deadline:
        await asyncio.sleep(0.05)
    if _loading:
        print("[bridge] page never finished loading — continuing anyway")
        _loading = False
    else:
        print(f"[bridge] waited for page to finish loading ({(loop.time() - start) * 1000:.0f}ms)")


def _remember_location(result):
    """list_elements replies include the page title/URL — keep 'where the user is' current."""
    global last_page
    if isinstance(result, dict) and result.get("url"):
        last_page = {**(last_page or {}), "title": result.get("title", ""), "url": result["url"]}


async def list_elements():
    await wait_while_loading()
    result = await send_command("list_elements")
    _remember_location(result)
    return result


async def read_text():
    """Main readable text of the page (article, forecast, results) — not just its controls."""
    await wait_while_loading()
    return await send_command("action", action="read_text")


async def ask_user(question, yes_no=False):
    """Send a question to the side panel and wait for the user's answer.

    Returns {"cancelled": True} if the user gives a new command instead of answering.
    """
    global _question_rid
    _question_rid = request_id + 1  # the id send_command is about to use
    try:
        return await send_command("ask_user", timeout=120.0, question=question, yes_no=yes_no)
    finally:
        _question_rid = None


async def wait_for_page(ready_before, loading_before, start_wait=None):
    """After an action that may navigate, wait until the new page has loaded.

    Returns "loaded", "no_navigation" (nothing happened within NAV_START_WAIT —
    e.g. a link that only scrolls or opens a menu), or "slow" (the page started
    loading but didn't finish within NAV_LOAD_WAIT).
    """
    loop = asyncio.get_running_loop()
    start = loop.time()
    started = False
    while True:
        if _page_ready_count > ready_before:
            return "loaded"
        if _page_loading_count > loading_before:
            started = True
        elapsed = loop.time() - start
        if not started and elapsed >= (NAV_START_WAIT if start_wait is None else start_wait):
            return "no_navigation"
        if elapsed >= NAV_LOAD_WAIT:
            return "slow"
        await asyncio.sleep(0.05)


async def open_new_tab(url):
    """Open url in a new tab (it becomes the active tab) and wait for it to load."""
    ready_before, loading_before = _page_ready_count, _page_loading_count
    result = await send_command("new_tab", url=url)
    if isinstance(result, dict) and result.get("success"):
        result["page"] = await wait_for_page(ready_before, loading_before, start_wait=NAV_START_WAIT_SUBMIT)
        if result["page"] == "loaded" and last_page:
            result["page_title"] = last_page.get("title", "")
    return result


async def do_action(action, element=None, value=None, submit=False, selector=None):
    kwargs = {"action": action}
    if selector:
        kwargs["selector"] = selector
    if element is not None:
        kwargs["element"] = element
    if value is not None:
        kwargs["value"] = value
    if submit:
        kwargs["submit"] = True
    await wait_while_loading()
    ready_before, loading_before = _page_ready_count, _page_loading_count
    result = await send_command("action", **kwargs)

    if isinstance(result, dict) and str(result.get("error", "")).startswith(UNREACHABLE) \
            and (_loading or _page_loading_count > loading_before):
        # The page was replaced while we were acting on it — not a real failure
        await wait_while_loading()
        print("[bridge] page changed mid-action")
        if action in ("search", "ask"):
            # Submitting a search/question loaded the results page before the
            # page script could reply — that's the search succeeding
            return {"success": True, "action": action, "submitted": True, "navigated": True,
                    "page": "loaded", "page_title": (last_page or {}).get("title", "")}
        return {"error": "A new page started loading before this action ran. Call read_page to see "
                         "the new page, and repeat the action only if it is still needed."}

    if isinstance(result, dict) and result.get("navigated") and not result.get("error"):
        start = time.time()
        page = await wait_for_page(
            ready_before, loading_before,
            start_wait=NAV_START_WAIT_SUBMIT if result.get("submitted") else NAV_START_WAIT,
        )
        result["page"] = page
        if page == "loaded" and last_page:
            result["page_title"] = last_page.get("title", "")
        print(f"[bridge] waited for page: {page} ({(time.time() - start) * 1000:.0f}ms)")
    return result


async def interactive_mode():
    """Simple REPL for testing the bridge manually."""
    print("[bridge] Interactive mode. Commands: list, click N, type N text, scroll, back, open URL, quit")
    loop = asyncio.get_event_loop()

    while True:
        try:
            line = await loop.run_in_executor(None, lambda: input("\n> "))
        except (EOFError, KeyboardInterrupt):
            break

        line = line.strip()
        if not line:
            continue
        if line == "quit":
            break

        if line == "list":
            result = await list_elements()
            if result and "elements" in result:
                print(f"Found {result['count']} elements:")
                for el in result["elements"]:
                    print(f"  {el['num']}: {el['label']} ({el['type']}){el.get('value', '')}")
            else:
                print(result)
            continue

        parts = line.split(None, 2)
        action = parts[0]

        start = time.time()

        if action in ("scroll", "back"):
            value = parts[1] if len(parts) > 1 else None
            result = await do_action(action, value=value)
        elif action == "open":
            url = parts[1] if len(parts) > 1 else None
            result = await do_action("open", value=url)
        elif action in ("click", "type", "select"):
            element = int(parts[1]) if len(parts) > 1 else None
            value = parts[2] if len(parts) > 2 else None
            result = await do_action(action, element=element, value=value)
        else:
            print(f"Unknown: {action}")
            continue

        elapsed = (time.time() - start) * 1000
        if result and result.get("success"):
            print(f"OK: {json.dumps(result)} ({elapsed:.0f}ms)")
        else:
            print(f"FAIL: {result}")


async def main():
    print(f"[bridge] Starting on ws://localhost:{PORT}")
    try:
        async with websockets.serve(handler, "localhost", PORT, origins=ALLOWED_ORIGINS):
            await interactive_mode()
    except OSError as e:
        if "address already in use" in str(e).lower():
            print(f"[bridge] Port {PORT} already in use. Stop the other server first.")
        else:
            raise


if __name__ == "__main__":
    asyncio.run(main())

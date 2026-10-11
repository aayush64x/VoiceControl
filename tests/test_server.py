"""Tests for the WebSocket bridge server."""

import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
import websockets

import server


@pytest.fixture(autouse=True)
def reset_server_state():
    server.client = None
    server.pending = {}
    server.request_id = 0
    server.last_page = None
    server.on_user_input = None
    server._transcriber = None
    server.on_cancel = None
    server._command_queue = None
    server._worker_task = None
    server._busy = False
    server._question_rid = None
    server._page_loading_count = 0
    server._page_ready_count = 0
    server._loading = False
    yield


@pytest.mark.asyncio
async def test_server_starts_and_accepts_connection():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            assert server.client is not None


@pytest.mark.asyncio
async def test_send_command_returns_error_when_no_client():
    result = await server.send_command("list_elements")
    assert "error" in result
    assert "not connected" in result["error"].lower()


@pytest.mark.asyncio
async def test_send_command_gets_response():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)

            async def fake_extension():
                raw = await ws.recv()
                msg = json.loads(raw)
                assert msg["type"] == "list_elements"
                await ws.send(json.dumps({
                    "id": msg["id"],
                    "result": {"elements": [{"num": 1, "type": "button", "label": "Go"}], "count": 1},
                }))

            result_task = asyncio.create_task(server.list_elements())
            await fake_extension()
            result = await result_task

            assert result["count"] == 1
            assert result["elements"][0]["label"] == "Go"


@pytest.mark.asyncio
async def test_send_action_command():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)

            async def fake_extension():
                raw = await ws.recv()
                msg = json.loads(raw)
                assert msg["type"] == "action"
                assert msg["action"] == "click"
                assert msg["element"] == 5
                await ws.send(json.dumps({
                    "id": msg["id"],
                    "result": {"success": True, "action": "click", "element": 5, "label": "Submit"},
                }))

            result_task = asyncio.create_task(server.do_action("click", element=5))
            await fake_extension()
            result = await result_task

            assert result["success"] is True
            assert result["label"] == "Submit"


@pytest.mark.asyncio
async def test_disconnection_returns_error():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        ws = await websockets.connect(f"ws://localhost:{port}")
        await asyncio.sleep(0.05)
        assert server.client is not None

        await ws.close()
        await asyncio.sleep(0.05)

        result = await server.send_command("list_elements")
        assert "error" in result


@pytest.mark.asyncio
async def test_pending_futures_cancelled_on_disconnect():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        ws = await websockets.connect(f"ws://localhost:{port}")
        await asyncio.sleep(0.05)

        result_task = asyncio.create_task(server.list_elements())
        await asyncio.sleep(0.05)
        await ws.close()
        await asyncio.sleep(0.1)

        result = await result_task
        assert "error" in result
        assert "disconnect" in result["error"].lower()


@pytest.mark.asyncio
async def test_malformed_json_does_not_crash():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send("not valid json{{{")
            await asyncio.sleep(0.05)
            assert server.client is not None


@pytest.mark.asyncio
async def test_ask_user_sends_question_and_gets_answer():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)

            async def fake_user():
                raw = await ws.recv()
                msg = json.loads(raw)
                assert msg["type"] == "ask_user"
                assert msg["question"] == "What is your date of birth?"
                assert msg["yes_no"] is False
                await ws.send(json.dumps({
                    "id": msg["id"],
                    "result": {"answer": "March 14, 1985"},
                }))

            result_task = asyncio.create_task(server.ask_user("What is your date of birth?", yes_no=False))
            await fake_user()
            result = await result_task

            assert result["answer"] == "March 14, 1985"


@pytest.mark.asyncio
async def test_ask_user_yes_no():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)

            async def fake_user():
                raw = await ws.recv()
                msg = json.loads(raw)
                assert msg["type"] == "ask_user"
                assert msg["yes_no"] is True
                await ws.send(json.dumps({
                    "id": msg["id"],
                    "result": {"answer": "Yes"},
                }))

            result_task = asyncio.create_task(server.ask_user("Submit the form?", yes_no=True))
            await fake_user()
            result = await result_task

            assert result["answer"] == "Yes"


@pytest.mark.asyncio
async def test_ask_user_no_client():
    result = await server.ask_user("Hello?")
    assert "error" in result
    assert "not connected" in result["error"].lower()


@pytest.mark.asyncio
async def test_send_command_custom_timeout():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            result = await server.send_command("ask_user", timeout=0.1, question="test")
            assert "error" in result
            assert "timeout" in result["error"].lower()


@pytest.mark.asyncio
async def test_user_said_routes_to_agent():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        async def fake_agent(text):
            return f"Did: {text}"

        server.on_user_input = fake_agent

        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "click the button"}))

            thinking = json.loads(await ws.recv())
            assert thinking["type"] == "agent_thinking"

            response = json.loads(await ws.recv())
            assert response["type"] == "agent_response"
            assert response["text"] == "Did: click the button"


@pytest.mark.asyncio
async def test_user_said_no_agent():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        server.on_user_input = None

        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "hello"}))

            response = json.loads(await ws.recv())
            assert response["type"] == "agent_response"
            assert "not ready" in response["text"].lower()


@pytest.mark.asyncio
async def test_user_said_while_busy_is_queued():
    """A command sent while one is running waits, then runs — never in parallel, never dropped."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        order = []
        running = 0
        max_running = 0

        async def tracking_agent(text):
            nonlocal running, max_running
            running += 1
            max_running = max(max_running, running)
            order.append(text)
            await asyncio.sleep(0.05)
            running -= 1
            return f"Done: {text}"

        server.on_user_input = tracking_agent

        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "first"}))
            await ws.send(json.dumps({"type": "user_said", "text": "second"}))

            messages = []
            while len([m for m in messages if m["type"] == "agent_response"]) < 2:
                messages.append(json.loads(await asyncio.wait_for(ws.recv(), timeout=2)))

            assert order == ["first", "second"]
            assert max_running == 1
            queued = [m for m in messages if m["type"] == "queued"]
            assert queued == [{"type": "queued", "text": "second", "ahead": 1}]
            responses = [m["text"] for m in messages if m["type"] == "agent_response"]
            assert responses == ["Done: first", "Done: second"]


@pytest.mark.asyncio
async def test_new_command_cancels_open_question():
    """Giving a new command while a question is on screen dismisses it and cancels the task."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        answers = []
        cancelled = []

        async def asking_agent(text):
            if text == "first":
                answers.append(await server.ask_user("Which one?"))
                return "first ended"
            return f"Done: {text}"

        server.on_user_input = asking_agent
        server.on_cancel = lambda: cancelled.append(True)

        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "first"}))
            while True:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
                if msg["type"] == "ask_user":
                    break

            await ws.send(json.dumps({"type": "user_said", "text": "second"}))
            messages = []
            while len([m for m in messages if m["type"] == "agent_response"]) < 2:
                messages.append(json.loads(await asyncio.wait_for(ws.recv(), timeout=2)))

            assert answers == [{"cancelled": True}]
            assert cancelled == [True]
            assert {"type": "question_cancelled"} in messages
            responses = [m["text"] for m in messages if m["type"] == "agent_response"]
            assert responses == ["first ended", "Done: second"]


@pytest.mark.asyncio
async def test_old_connection_closing_keeps_new_client():
    """Reopening the side panel: the old socket closing must not disconnect the new one."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        old = await websockets.connect(f"ws://localhost:{port}")
        await asyncio.sleep(0.05)
        async with websockets.connect(f"ws://localhost:{port}") as new:
            await asyncio.sleep(0.05)
            await old.close()
            await asyncio.sleep(0.05)
            assert server.client is not None

            task = asyncio.create_task(server.list_elements())
            msg = json.loads(await asyncio.wait_for(new.recv(), timeout=2))
            await new.send(json.dumps({"id": msg["id"], "result": {"elements": [], "count": 0}}))
            assert await task == {"elements": [], "count": 0}


@pytest.mark.asyncio
async def test_voice_start_stop():
    """voice_start and voice_stop messages don't crash the handler."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "voice_stop"}))
            await asyncio.sleep(0.05)
            assert server.client is not None


@pytest.mark.asyncio
async def test_user_said_empty_ignored():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        call_count = 0

        async def counting_agent(text):
            nonlocal call_count
            call_count += 1
            return "ok"

        server.on_user_input = counting_agent

        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": ""}))
            await ws.send(json.dumps({"type": "user_said", "text": "   "}))
            await asyncio.sleep(0.2)
            assert call_count == 0


async def _run_with_queue(control_text):
    """'first' runs slowly, 'second' is queued, then a control word arrives."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        ran = []
        cancelled = asyncio.Event()

        async def slow_agent(text):
            ran.append(text)
            if text == "first":
                try:
                    await asyncio.wait_for(cancelled.wait(), timeout=2)
                    cancelled.clear()
                    return "Stopped: first"
                except asyncio.TimeoutError:
                    return "Done: first"
            return f"Done: {text}"

        server.on_user_input = slow_agent
        server.on_cancel = cancelled.set
        messages = []
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "first"}))
            await ws.send(json.dumps({"type": "user_said", "text": "second"}))
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": control_text}))
            try:
                while True:
                    messages.append(json.loads(await asyncio.wait_for(ws.recv(), timeout=0.6)))
            except asyncio.TimeoutError:
                pass
        return ran, messages


@pytest.mark.asyncio
async def test_stop_interrupts_current_task_but_queue_continues():
    ran, messages = await _run_with_queue("Stop!")
    assert ran == ["first", "second"]
    responses = [m["text"] for m in messages if m["type"] == "agent_response"]
    assert responses == ["Stopped: first", "Done: second"]


@pytest.mark.asyncio
async def test_stop_everything_also_clears_the_queue_and_resets_the_panel():
    ran, messages = await _run_with_queue("stop everything")
    assert ran == ["first"]
    assert {"type": "reset", "start_over": False} in messages
    assert [m["text"] for m in messages if m["type"] == "agent_response"] == ["Stopped: first"]


@pytest.mark.asyncio
async def test_start_over_when_idle():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "Start over."}))
            assert json.loads(await asyncio.wait_for(ws.recv(), timeout=2)) == {"type": "reset", "start_over": True}
            assert json.loads(await asyncio.wait_for(ws.recv(), timeout=2)) == {
                "type": "agent_response", "text": "Starting over. What would you like to do?"}


@pytest.mark.asyncio
async def test_stop_when_idle_replies():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "stop stop"}))
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            assert msg == {"type": "agent_response", "text": "Nothing to stop."}


@pytest.mark.asyncio
async def test_cancel_at_a_question_answers_no():
    """At 'Should I submit?', saying 'cancel' means no — the task continues and nothing is sent."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        answers = []
        cancelled = []

        async def asking_agent(text):
            answers.append(await server.ask_user("Should I submit?", yes_no=True))
            return "Not submitted."

        server.on_user_input = asking_agent
        server.on_cancel = lambda: cancelled.append(True)
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "fill the form"}))
            while json.loads(await asyncio.wait_for(ws.recv(), timeout=2))["type"] != "ask_user":
                pass
            await ws.send(json.dumps({"type": "user_said", "text": "Cancel."}))
            while True:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
                if msg["type"] == "agent_response":
                    break
        assert answers == [{"answer": "No"}]
        assert cancelled == []  # the task wasn't killed; it heard "no"
        assert msg["text"] == "Not submitted."


def test_control_phrases_are_exact():
    assert server.control_phrase("Stop! stop.") == "stop"
    assert server.control_phrase("Stop everything.") == "stop everything"
    for normal in ["cancel my subscription", "stop the video", "start over the form from page one"]:
        assert server.control_phrase(normal) not in server.STOP_ONE | server.STOP_ALL | server.CANCEL


@pytest.mark.asyncio
async def test_websites_cannot_connect():
    """A web page opening ws://localhost must be rejected; the extension and scripts are allowed."""
    async with websockets.serve(server.handler, "localhost", 0, origins=server.ALLOWED_ORIGINS) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        url = f"ws://localhost:{port}"

        with pytest.raises(websockets.InvalidStatus):
            await websockets.connect(url, origin="https://evil.example")
        with pytest.raises(websockets.InvalidStatus):
            await websockets.connect(url, origin="chrome-extension://not-a-real-id")

        async with websockets.connect(url, origin="chrome-extension://" + "a" * 32):
            pass
        async with websockets.connect(url):  # no Origin header (scripts/tests)
            pass


async def _fake_extension(port, on_action):
    """Connect as the extension; on_action(ws, msg) answers each action command."""
    ws = await websockets.connect(f"ws://localhost:{port}")

    async def loop():
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "action":
                await on_action(ws, msg)

    task = asyncio.create_task(loop())
    await asyncio.sleep(0.05)
    return ws, task


@pytest.mark.asyncio
async def test_navigating_action_waits_for_new_page(monkeypatch):
    """A click that loads a new page returns only after the new page is ready."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        async def on_action(ws, msg):
            await ws.send(json.dumps({"id": msg["id"], "result": {"success": True, "action": "click", "navigated": True}}))
            await asyncio.sleep(0.2)
            await ws.send(json.dumps({"type": "page_loading", "url": "https://x.test/b"}))
            await asyncio.sleep(0.3)
            await ws.send(json.dumps({"type": "page_ready", "title": "Forecast", "url": "https://x.test/b", "count": 3}))

        ws, task = await _fake_extension(port, on_action)
        start = asyncio.get_running_loop().time()
        result = await server.do_action("click", element=5)
        elapsed = asyncio.get_running_loop().time() - start
        task.cancel()
        await ws.close()

        assert result["page"] == "loaded"
        assert result["page_title"] == "Forecast"
        assert 0.4 < elapsed < 2


@pytest.mark.asyncio
async def test_link_that_does_not_navigate_returns_quickly(monkeypatch):
    """If no page load starts (e.g. a link that opens a menu), don't wait the full timeout."""
    monkeypatch.setattr(server, "NAV_START_WAIT", 0.3)
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        async def on_action(ws, msg):
            await ws.send(json.dumps({"id": msg["id"], "result": {"success": True, "action": "click", "navigated": True}}))

        ws, task = await _fake_extension(port, on_action)
        result = await server.do_action("click", element=5)
        task.cancel()
        await ws.close()
        assert result["page"] == "no_navigation"


@pytest.mark.asyncio
async def test_slow_page_reported_not_hung(monkeypatch):
    monkeypatch.setattr(server, "NAV_LOAD_WAIT", 0.4)
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        async def on_action(ws, msg):
            await ws.send(json.dumps({"type": "page_loading", "url": "https://slow.test"}))
            await ws.send(json.dumps({"id": msg["id"], "result": {"success": True, "action": "back", "navigated": True}}))

        ws, task = await _fake_extension(port, on_action)
        result = await server.do_action("back")
        task.cancel()
        await ws.close()
        assert result["page"] == "slow"


@pytest.mark.asyncio
async def test_page_ready_before_reply_still_counts():
    """Fast pages can finish loading before the action's reply arrives."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        async def on_action(ws, msg):
            await ws.send(json.dumps({"type": "page_ready", "title": "Fast", "url": "https://f.test", "count": 1}))
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"id": msg["id"], "result": {"success": True, "action": "click", "navigated": True}}))

        ws, task = await _fake_extension(port, on_action)
        result = await server.do_action("click", element=1)
        task.cancel()
        await ws.close()
        assert result["page"] == "loaded"


@pytest.mark.asyncio
async def test_non_navigating_action_does_not_wait():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        async def on_action(ws, msg):
            await ws.send(json.dumps({"id": msg["id"], "result": {"success": True, "action": "type", "changed": True}}))

        ws, task = await _fake_extension(port, on_action)
        result = await server.do_action("type", element=2, value="hi")
        task.cancel()
        await ws.close()
        assert "page" not in result


def test_wants_speech_only_when_asked():
    assert server.wants_speech("read it out loud for me")
    assert server.wants_speech("read this to me")
    assert server.wants_speech("read the article aloud")
    assert not server.wants_speech("weather in Kansas City")
    assert not server.wants_speech("read the page")


@pytest.mark.asyncio
async def test_actions_wait_while_a_page_is_loading(monkeypatch):
    """A page that's mid-load is waited for before the next command touches it."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "page_loading", "url": "https://x.test/next"}))
            await asyncio.sleep(0.05)
            task = asyncio.create_task(server.list_elements())
            await asyncio.sleep(0.3)
            assert not task.done()  # still waiting for the page to finish
            await ws.send(json.dumps({"type": "page_ready", "title": "Next", "url": "https://x.test/next", "count": 0}))
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            assert msg["type"] == "list_elements"
            await ws.send(json.dumps({"id": msg["id"], "result": {"elements": [], "count": 0, "title": "Next", "url": "https://x.test/next"}}))
            await task
            assert server.last_page["url"] == "https://x.test/next"


@pytest.mark.asyncio
async def test_page_that_never_loads_does_not_block_forever(monkeypatch):
    monkeypatch.setattr(server, "NAV_LOAD_WAIT", 0.3)
    server._loading = True
    start = asyncio.get_running_loop().time()
    await server.wait_while_loading()
    assert asyncio.get_running_loop().time() - start < 1
    assert server._loading is False


@pytest.mark.asyncio
async def test_unreachable_during_navigation_becomes_helpful_message():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        async def on_action(ws, msg):
            await ws.send(json.dumps({"type": "page_loading", "url": "https://x.test/b"}))
            await ws.send(json.dumps({"id": msg["id"], "result": {"error": "Could not reach this page."}}))
            await asyncio.sleep(0.1)
            await ws.send(json.dumps({"type": "page_ready", "title": "B", "url": "https://x.test/b", "count": 0}))

        ws, task = await _fake_extension(port, on_action)
        result = await server.do_action("type", element=13, value="x")
        task.cancel()
        await ws.close()
        assert "new page started loading" in result["error"]


@pytest.mark.asyncio
async def test_click_that_reloads_the_page_counts_as_success():
    """A Next button that reloads the page kills the page script before it replies."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]

        async def on_action(ws, msg):
            await ws.send(json.dumps({"type": "page_loading", "url": "https://x.test/q2"}))
            await ws.send(json.dumps({"id": msg["id"], "result": {"error": "Could not reach this page."}}))
            await asyncio.sleep(0.1)
            await ws.send(json.dumps({"type": "page_ready", "title": "Question 2", "url": "https://x.test/q2", "count": 4}))

        ws, task = await _fake_extension(port, on_action)
        result = await server.do_action("click", element=9)
        task.cancel()
        await ws.close()
        assert result["success"] and result["navigated"] and result["page_title"] == "Question 2"


@pytest.mark.asyncio
async def test_open_new_tab_waits_for_the_new_page():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            task = asyncio.create_task(server.open_new_tab("https://claude.ai"))
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            assert msg["type"] == "new_tab" and msg["url"] == "https://claude.ai"
            await ws.send(json.dumps({"id": msg["id"], "result": {"success": True, "url": msg["url"]}}))
            await asyncio.sleep(0.1)
            await ws.send(json.dumps({"type": "page_ready", "title": "Claude", "url": "https://claude.ai/new", "count": 9}))
            result = await asyncio.wait_for(task, timeout=3)
            assert result["page"] == "loaded" and result["page_title"] == "Claude"


@pytest.mark.asyncio
async def test_voice_level_streams_while_recording(monkeypatch):
    """The panel gets the mic's loudness while recording, then a release (None) when it stops."""
    monkeypatch.setattr(server, "LEVEL_INTERVAL", 0.02)
    sent = []

    async def to_panel(msg):
        sent.append(msg)

    monkeypatch.setattr(server, "_send_to_client", to_panel)

    class FakeTranscriber:
        running = True
        level = 0.42

    t = FakeTranscriber()
    task = asyncio.create_task(server._stream_levels(t))
    await asyncio.sleep(0.07)
    t.running = False
    await asyncio.wait_for(task, timeout=1)
    assert {"type": "level", "value": 0.42} in sent
    assert sent[-1] == {"type": "level", "value": None}


def test_control_words_in_spanish_and_korean():
    one, all_, cancel = server.STOP_ONE, server.STOP_ALL, server.CANCEL
    assert server.control_phrase("¡Para!") in one
    assert server.control_phrase("¡Detén todo!") in all_
    assert server.control_phrase("Empieza de nuevo.") in server.START_OVER
    assert server.control_phrase("Cancélalo") in cancel
    assert server.control_phrase("멈춰!") in one
    assert server.control_phrase("모두 멈춰") in all_
    assert server.control_phrase("처음부터 다시") in server.START_OVER
    assert server.control_phrase("취소해줘") in cancel
    assert server.control_phrase("para mi mamá") not in one | all_ | cancel


@pytest.mark.asyncio
async def test_set_language_from_panel_and_listening_language(monkeypatch):
    sent = []

    async def to_panel(msg):
        sent.append(msg)

    monkeypatch.setattr(server, "_send_to_client", to_panel)
    assert await server.set_language("ko")
    assert server.language == "ko"
    assert sent == [{"type": "language", "lang": "ko"}]
    assert server.LANGUAGES[server.language]["stt"] == "ko-KR"
    assert server.localized("nothing") == "멈출 작업이 없습니다."
    assert not await server.set_language("xx")
    await server.set_language("en")


def test_wants_speech_in_other_languages():
    assert server.wants_speech("léelo en voz alta")
    assert server.wants_speech("읽어줘")
    assert not server.wants_speech("busca videos de gatos")

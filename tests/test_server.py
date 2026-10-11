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


@pytest.mark.asyncio
async def test_stop_drops_queue_and_cancels_running_task():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        ran = []
        cancelled = asyncio.Event()

        async def slow_agent(text):
            ran.append(text)
            try:
                await asyncio.wait_for(cancelled.wait(), timeout=2)
                return "Stopped."
            except asyncio.TimeoutError:
                return f"Done: {text}"

        server.on_user_input = slow_agent
        server.on_cancel = cancelled.set

        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "first"}))
            await ws.send(json.dumps({"type": "user_said", "text": "second"}))
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "Stop."}))

            responses = []
            while not responses:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
                if msg["type"] == "agent_response":
                    responses.append(msg["text"])
            await asyncio.sleep(0.1)

            assert responses == ["Stopped."]
            assert ran == ["first"]  # "second" was dropped from the queue


@pytest.mark.asyncio
async def test_stop_when_idle_replies():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "cancel"}))
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            assert msg == {"type": "agent_response", "text": "Stopped."}


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

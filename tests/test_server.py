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
    server._processing = False
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
async def test_user_said_while_busy_is_rejected():
    """A second command sent while one is running gets 'still processing', not run in parallel."""
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        order = []

        async def tracking_agent(text):
            order.append(text)
            await asyncio.sleep(0.05)
            return f"Done: {text}"

        server.on_user_input = tracking_agent

        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send(json.dumps({"type": "user_said", "text": "first"}))
            await ws.send(json.dumps({"type": "user_said", "text": "second"}))

            messages = []
            for _ in range(3):
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
                messages.append(msg)

            assert order == ["first"]
            responses = [m["text"] for m in messages if m["type"] == "agent_response"]
            assert "Still processing previous command..." in responses
            assert "Done: first" in responses

            # Once the first finishes, a new command is accepted
            await ws.send(json.dumps({"type": "user_said", "text": "third"}))
            for _ in range(2):
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
            assert msg == {"type": "agent_response", "text": "Done: third"}


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
